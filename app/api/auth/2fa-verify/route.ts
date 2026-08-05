import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyTwoFactorCode } from '@/lib/two-factor'
import { buildSessionCookie, sessionTimeoutToSeconds, type SessionPayload } from '@/lib/session-cookie'
import { getSecuritySettings } from '@/lib/settings'
import { isLockedOut, recordFailedAttempt, clearAttempts } from '@/lib/login-attempts'

// AUDIT.md #439 — decodes (but does not itself verify the signature of) a
// Supabase access-token JWT payload, to read the standard `session_id`
// claim Supabase Auth embeds in every access token. Only called AFTER
// db.auth.getUser(token) below has already confirmed the token's
// signature is valid and it belongs to the email that just completed a
// real 2FA code check — same "decode after independent verification"
// pattern app/api/auth/google-verify/route.ts already uses for the Google
// credential.
function decodeJwtSessionId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    return typeof payload?.session_id === 'string' ? payload.session_id : null
  } catch {
    return null
  }
}

// AUDIT.md #207 — completes the "Two-Factor Auth: Required" flow started
// by /api/auth/google-verify (which, when 2FA is required, emails a code
// instead of issuing a session directly). Re-checks the same status/
// access_schedule invariants getCurrentUser() would, since real time has
// passed since the code was issued and either could have changed.
export const POST = withErrorHandler('auth/2fa-verify POST', async (req) => {
  const { email, code } = await req.json()
  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const security = await getSecuritySettings()
  if (await isLockedOut(normalizedEmail, security.loginAttempts)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Please wait 30 minutes and try again.' },
      { status: 429 },
    )
  }

  const db = createServiceClient()
  const { data: member } = await db
    .from('team_members')
    .select('id, name, email, role, unit, initials, is_admin, status, access_schedule')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 })
  }
  if (member.status !== 'active') {
    return NextResponse.json({ error: 'Your account is not active. Contact an administrator.' }, { status: 403 })
  }
  const schedule = member.access_schedule as { removeAccessOn?: string; reinstateOn?: string } | null
  if (schedule?.removeAccessOn) {
    const now = Date.now()
    const removeAt = new Date(schedule.removeAccessOn).getTime()
    const reinstateAt = schedule.reinstateOn ? new Date(schedule.reinstateOn).getTime() : null
    if (removeAt <= now && (!reinstateAt || reinstateAt > now)) {
      return NextResponse.json({ error: 'Your access is currently restricted.' }, { status: 403 })
    }
  }

  const valid = await verifyTwoFactorCode(member.id, String(code))
  if (!valid) {
    await recordFailedAttempt(normalizedEmail)
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }
  await clearAttempts(normalizedEmail)

  // AUDIT.md #439 — if this browser already holds a live Supabase Auth
  // session (the magic-link path: supabase.auth.signInWithOtp() establishes
  // one the instant the link is clicked, well before this 2FA check ever
  // runs — see app/auth/confirm/page.tsx), mark that EXACT session as 2FA
  // -verified so RLS policies (is_staff() -> staff_two_factor_ok(), see
  // supabase/migrations/enforce_2fa_session_rls.sql) start accepting it.
  // Google Sign-In never establishes a Supabase session at all, so this is
  // simply a no-op (no Authorization header) on that path — there's no
  // Supabase JWT to protect there in the first place. Best-effort: a
  // failure here must not block the 2FA flow itself (the httpOnly cookie
  // below is this app's real, already-working access gate) — it only means
  // this specific browser's direct-to-Supabase RLS hardening doesn't kick
  // in until its next login, so it's logged, not thrown.
  const authHeader = req.headers.get('authorization')
  const supabaseAccessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (supabaseAccessToken) {
    try {
      const { data: { user: supabaseUser }, error: supabaseUserErr } = await db.auth.getUser(supabaseAccessToken)
      if (!supabaseUserErr && supabaseUser && supabaseUser.email?.toLowerCase() === normalizedEmail) {
        const sessionId = decodeJwtSessionId(supabaseAccessToken)
        if (sessionId) {
          const { error: upsertErr } = await db.from('two_factor_verified_sessions').upsert({
            session_id: sessionId,
            user_id: supabaseUser.id,
          })
          if (upsertErr) console.error('[2fa-verify] failed to record verified session (RLS hardening skipped for this session):', upsertErr.message)
        }
      }
    } catch (e) {
      console.error('[2fa-verify] error recording verified Supabase session:', e)
    }
  }

  const user: SessionPayload & { name: string; unit: string; initials: string; userType: 'staff' } = {
    id:       member.id,
    email:    member.email,
    name:     member.name,
    role:     member.role,
    unit:     member.unit,
    initials: member.initials ?? '',
    isAdmin:  member.is_admin ?? false,
    userType: 'staff',
  }

  const res = NextResponse.json({ user })
  res.cookies.set(await buildSessionCookie({
    id: user.id,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    userType: user.userType,
    // AUDIT.md #343 — this is the one place a real 2FA code is ever
    // checked, so it's the only place that gets to stamp this. See the
    // matching comment in app/api/auth/session/route.ts.
    twoFactorVerifiedAt: Math.floor(Date.now() / 1000),
  }, sessionTimeoutToSeconds(security.sessionTimeout)))
  return res
})
