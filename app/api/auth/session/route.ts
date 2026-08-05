import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { buildSessionCookie, verifySessionCookie, sessionTimeoutToSeconds, REMEMBER_ME_SECONDS, SESSION_COOKIE_NAME } from '@/lib/session-cookie'
import { getSecuritySettings } from '@/lib/settings'
import { onPortalFirstLogin } from '@/lib/delivery-sync'
import { sendTwoFactorCode } from '@/lib/two-factor'

/**
 * Exchanges a real Supabase access token (proven via db.auth.getUser) for a
 * signed gravhub-auth session cookie. Called by AuthContext whenever it has
 * a live Supabase session — password login, magic-link-via-Supabase, and
 * session restore on page load/token refresh. Also called directly by
 * app/auth/confirm/page.tsx right after a magic-link sign-in, so it can show
 * a 2FA code-entry step inline — see the 2FA gate comment below for how
 * this route tells a fresh login apart from a routine refresh.
 */
export const POST = withErrorHandler('auth/session POST', async (req) => {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  // "Remember me" checkbox on the client-portal password sign-in form
  // (app/login/page.tsx) — only that flow ever sends this; every other
  // caller (magic-link confirm, routine session-restore/refresh) sends no
  // body at all, so this defaults to false for them.
  //
  // AUDIT — this used to be honored unconditionally for BOTH staff and
  // portal-client cookies, with nothing server-side restricting it to the
  // one flow that actually has the checkbox: any authenticated caller
  // (including a staff account, via a raw POST with {rememberMe: true})
  // could self-grant a 30-day cookie regardless of the admin-configured
  // Session Timeout security setting. Now only ever applied in the
  // portal-client branch below.
  const { rememberMe: requestedRememberMe } = await req.json().catch(() => ({ rememberMe: false } as { rememberMe?: boolean }))

  const db = createServiceClient()
  const { data: { user: authUser }, error } = await db.auth.getUser(token)
  if (error || !authUser?.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
  const email = authUser.email.toLowerCase()

  const { data: teamRow } = await db
    .from('team_members')
    .select('id, email, name, role, is_admin, status, access_schedule')
    .ilike('email', email)
    .maybeSingle()

  // Mirrors the portal_clients branch below, which already rejects
  // access === 'Disabled' — this never checked status, so a suspended or
  // soft-deleted staff member could still exchange a live Supabase token
  // for a fresh gravhub-auth session.
  if (teamRow && teamRow.status !== 'active') {
    return NextResponse.json({ error: 'Your account is not active. Contact an administrator.' }, { status: 403 })
  }

  // AUDIT.md #533 — mirrors the access_schedule enforcement already in
  // lib/rbac.ts's getCurrentUser() (#208), lib/admin-auth.ts's
  // requireAdmin(), app/api/auth/google-verify/route.ts (#505), and this
  // same login's own 2fa-verify route. This route mints/reissues the
  // gravhub-auth cookie for both magic-link login and every routine
  // Supabase token-refresh, so without this a staff member mid-scheduled-
  // removal could still get a fresh valid session cookie here (when 2FA is
  // Optional/Disabled) even though every requireRole/requireAdmin call
  // would reject them on the very next request.
  if (teamRow) {
    const schedule = teamRow.access_schedule as { removeAccessOn?: string; reinstateOn?: string } | null
    if (schedule?.removeAccessOn) {
      const now = Date.now()
      const removeAt = new Date(schedule.removeAccessOn).getTime()
      const reinstateAt = schedule.reinstateOn ? new Date(schedule.reinstateOn).getTime() : null
      if (removeAt <= now && (!reinstateAt || reinstateAt > now)) {
        return NextResponse.json({ error: 'Your access is currently restricted.' }, { status: 403 })
      }
    }
  }

  // AUDIT.md #207 — Session Timeout previously had zero effect.
  const security = await getSecuritySettings()
  const staffMaxAgeSeconds = sessionTimeoutToSeconds(security.sessionTimeout)

  // AUDIT.md #343 — this route is called for both a fresh magic-link/OTP
  // login AND routine session-restore/token-refresh, and gating 2FA
  // unconditionally would force a fresh code on every refresh, not just
  // real new logins. The distinguishing signal is NOT a client-supplied
  // flag/query param — an earlier version of this fix used one
  // (`fresh=1`, sent only by app/auth/confirm/page.tsx's own call), but a
  // security review correctly caught that contexts/AuthContext.tsx has a
  // SECOND, independent call path (its mount-time getSession()-driven
  // restore, separate from the onAuthStateChange listener) that never sent
  // the flag — since the underlying Supabase session is already live the
  // instant the magic link is clicked, a page reload before the 2FA code
  // was entered hit that second path and got a cookie with zero 2FA check.
  //
  // Instead: does the request already carry a VALID, already-signed
  // gravhub-auth cookie for this exact staff email that itself proves 2FA
  // was completed for THIS browser session? Checking email-match alone
  // (an earlier version of this fix) isn't enough — a second security
  // review found that any still-live cookie for that email would pass,
  // including one issued before 2FA was ever turned on for this account
  // (2FA cookies never expire early just because the setting changed later,
  // and this route reissues the cookie with a fresh maxAge on every refresh
  // — that combination meant "Required" had no effect on any session that
  // was already live when the setting was turned on). So the cookie itself
  // has to carry proof, not just presence: `twoFactorVerifiedAt` is stamped
  // only by app/api/auth/2fa-verify/route.ts, the one place a real code is
  // actually checked (see lib/session-cookie.ts). Also require
  // `userType === 'staff'` — email alone could theoretically be satisfied
  // by an unrelated portal_clients cookie for the same address, and clients
  // never go through 2FA at all.
  const existingCookie = await verifySessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value)
  const existingStaffCookieForThisUser = existingCookie?.email?.toLowerCase() === email && existingCookie.userType === 'staff'
    ? existingCookie
    : null
  const hasVerifiedStaffSession = typeof existingStaffCookieForThisUser?.twoFactorVerifiedAt === 'number'
  if (teamRow && !hasVerifiedStaffSession && security.twoFactor === 'required') {
    await sendTwoFactorCode(teamRow.id, teamRow.email, teamRow.name)
    return NextResponse.json({ requires2FA: true, email: teamRow.email })
  }

  if (teamRow) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(await buildSessionCookie({
      id: teamRow.id,
      email: teamRow.email,
      role: teamRow.role,
      isAdmin: teamRow.is_admin ?? false,
      userType: 'staff',
      // Carry the verification timestamp forward across routine refreshes
      // rather than dropping it — this cookie rebuild only ever happens
      // when 2FA wasn't required for this session (nothing to carry) or
      // the gate above already confirmed it was verified.
      twoFactorVerifiedAt: existingStaffCookieForThisUser?.twoFactorVerifiedAt,
    }, staffMaxAgeSeconds))
    return res
  }

  const { data: clientRow } = await db
    .from('portal_clients')
    .select('id, email, company, company_id, access, pending_approval, last_login')
    .ilike('email', email)
    .maybeSingle()

  if (!clientRow || clientRow.access === 'Disabled') {
    return NextResponse.json({ error: 'No active account for this session' }, { status: 403 })
  }

  // AUDIT.md #195 — same pending-approval gap as google-verify: a client
  // awaiting admin approval could still exchange a live Supabase token for
  // a fresh gravhub-auth session here, since only `access === 'Disabled'`
  // was ever checked.
  if (clientRow.pending_approval) {
    return NextResponse.json({ error: 'Your portal access is awaiting admin approval.' }, { status: 403 })
  }

  // AUDIT — "Remember me" used to be a pure request-body flag: the initial
  // login correctly got a 30-day cookie, but the very next routine token
  // refresh or mount-time session restore (neither of which re-sends the
  // checkbox's one-shot sessionStorage flag) silently rebuilt the cookie at
  // the default Session Timeout, defeating the feature almost immediately.
  // Carry it forward from the existing cookie (same identity-scoped pattern
  // twoFactorVerifiedAt already uses above) so once granted, it survives
  // every later reissue for this session, not just the first one.
  const existingClientCookieForThisUser = existingCookie?.email?.toLowerCase() === email && existingCookie.userType === 'client'
    ? existingCookie
    : null
  const rememberMe = requestedRememberMe === true || existingClientCookieForThisUser?.rememberMe === true
  const clientMaxAgeSeconds = rememberMe ? REMEMBER_ME_SECONDS : sessionTimeoutToSeconds(security.sessionTimeout)

  // Delivery step 4 ("Portal Access") — one of three routes that can
  // establish a client session, all three wired so which one a client
  // happens to use doesn't decide whether their onboarding board is right.
  //
  // Gated on last_login and awaited, not fire-and-forget. This route runs on
  // every session restore and token refresh, so an un-awaited call would both
  // add a DB round trip to a very hot path AND usually be dropped anyway —
  // the serverless instance freezes once the response is sent. Gating means
  // the work happens at most once per client, which makes awaiting it cheap.
  if (!clientRow.last_login || clientRow.last_login === 'Never') {
    await onPortalFirstLogin(clientRow)
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(await buildSessionCookie({
    id: clientRow.id,
    email: clientRow.email,
    role: 'Client',
    isAdmin: false,
    userType: 'client',
    rememberMe: rememberMe || undefined,
  }, clientMaxAgeSeconds))
  return res
})

export const DELETE = withErrorHandler('auth/session DELETE', async () => {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 })
  return res
})
