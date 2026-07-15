import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { buildSessionCookie, SESSION_COOKIE_NAME } from '@/lib/session-cookie'

/**
 * Exchanges a real Supabase access token (proven via db.auth.getUser) for a
 * signed gravhub-auth session cookie. Called by AuthContext whenever it has
 * a live Supabase session — password login, magic-link-via-Supabase, and
 * session restore on page load/token refresh.
 */
export const POST = withErrorHandler('auth/session POST', async (req) => {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data: { user: authUser }, error } = await db.auth.getUser(token)
  if (error || !authUser?.email) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
  const email = authUser.email.toLowerCase()

  const { data: teamRow } = await db
    .from('team_members')
    .select('id, email, role, is_admin, status')
    .ilike('email', email)
    .maybeSingle()

  // Mirrors the portal_clients branch below, which already rejects
  // access === 'Disabled' — this never checked status, so a suspended or
  // soft-deleted staff member could still exchange a live Supabase token
  // for a fresh gravhub-auth session.
  if (teamRow && teamRow.status !== 'active') {
    return NextResponse.json({ error: 'Your account is not active. Contact an administrator.' }, { status: 403 })
  }

  if (teamRow) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(await buildSessionCookie({
      id: teamRow.id,
      email: teamRow.email,
      role: teamRow.role,
      isAdmin: teamRow.is_admin ?? false,
      userType: 'staff',
    }))
    return res
  }

  const { data: clientRow } = await db
    .from('portal_clients')
    .select('id, email, access')
    .ilike('email', email)
    .maybeSingle()

  if (!clientRow || clientRow.access === 'Disabled') {
    return NextResponse.json({ error: 'No active account for this session' }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(await buildSessionCookie({
    id: clientRow.id,
    email: clientRow.email,
    role: 'Client',
    isAdmin: false,
    userType: 'client',
  }))
  return res
})

export const DELETE = withErrorHandler('auth/session DELETE', async () => {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 })
  return res
})
