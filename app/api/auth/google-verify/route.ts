import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { buildSessionCookie, type SessionPayload } from '@/lib/session-cookie'

async function respondWithUser(user: SessionPayload & { name: string; unit: string; initials: string; avatar?: string; company?: string }) {
  const res = NextResponse.json({ user })
  res.cookies.set(await buildSessionCookie({
    id: user.id,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    userType: user.userType,
  }))
  return res
}

/**
 * POST /api/auth/google-verify
 *
 * Accepts a Google Identity Services JWT credential, decodes it,
 * and looks up the user in team_members and portal_clients.
 * Returns a minimal user profile for the client to populate AuthContext.
 *
 * Hardened against server-side timeouts: tokeninfo verification has a
 * 3s budget, then falls back to the JWT payload (signature was already
 * verified client-side by GIS before the credential reached us).
 */
export const POST = withErrorHandler('auth/google-verify POST', async (req) => {
  const { credential } = await req.json().catch(() => ({}))
  if (!credential || typeof credential !== 'string') {
    return NextResponse.json({ error: 'Missing credential' }, { status: 400 })
  }

  // Decode JWT payload (signature verified client-side by GIS)
  const parts = credential.split('.')
  if (parts.length !== 3) {
    return NextResponse.json({ error: 'Invalid credential format' }, { status: 400 })
  }

  const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  // Pad for base64 decoding
  const padded = payloadB64 + '='.repeat((4 - payloadB64.length % 4) % 4)

  let payload: { email?: string; name?: string; picture?: string; sub?: string; aud?: string; exp?: number }
  try {
    payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid credential payload' }, { status: 400 })
  }

  // Check JWT exp (Google JWTs usually expire in 1 hour)
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    return NextResponse.json(
      { error: 'Google sign-in token expired. Please try signing in again.' },
      { status: 401 },
    )
  }

  // Extract email from JWT payload first — this is authoritative since GIS
  // has already verified the signature. We use tokeninfo as belt-and-braces
  // but don't fail if it's slow or unavailable.
  let email = payload.email?.toLowerCase()

  // Server-side JWT verification via Google's tokeninfo endpoint.
  // Bounded at 5 seconds. Verification is REQUIRED — we reject if it fails.
  const expectedAud = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!expectedAud) {
    // Fail closed, not open — without an expected audience configured, a
    // validly-signed token from ANY Google OAuth client (not just this
    // app's) would otherwise pass the check below unverified.
    console.error('[google-verify] GOOGLE_CLIENT_ID/NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured — rejecting sign-in')
    return NextResponse.json(
      { error: 'Google sign-in is not configured on this server.' },
      { status: 500 },
    )
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      { signal: controller.signal },
    )
    clearTimeout(timeout)

    if (!tokenInfoRes.ok) {
      console.error('[google-verify] tokeninfo returned', tokenInfoRes.status)
      return NextResponse.json(
        { error: 'Google token verification failed. Please try signing in again.' },
        { status: 401 },
      )
    }

    const tokenInfo = await tokenInfoRes.json()
    if (tokenInfo.aud && tokenInfo.aud !== expectedAud) {
      console.error('[google-verify] audience mismatch', { expected: expectedAud, actual: tokenInfo.aud })
      return NextResponse.json(
        { error: 'Sign-in token audience mismatch — check that GOOGLE_CLIENT_ID matches NEXT_PUBLIC_GOOGLE_CLIENT_ID in your environment.' },
        { status: 403 },
      )
    }
    if (tokenInfo.email) email = String(tokenInfo.email).toLowerCase()
  } catch (verifyErr) {
    console.error('[google-verify] tokeninfo call failed/timed out:', verifyErr)
    return NextResponse.json(
      { error: 'Could not verify Google sign-in token. Please try again.' },
      { status: 502 },
    )
  }

  if (!email) {
    return NextResponse.json({ error: 'No email found in Google credential' }, { status: 400 })
  }

  const db = createServiceClient()

  // ── 1. Check team_members (staff) — @gravissmarketing.com or direct match ──
  const { data: teamRow, error: teamErr } = await db
    .from('team_members')
    .select('id, email, name, role, unit, initials, is_admin, status')
    .ilike('email', email)
    .maybeSingle()

  if (teamErr) {
    throw new Error(`Database error while looking up team profile: ${teamErr.message}`)
  }

  if (teamRow) {
    // Unlike the portal_clients branch below (which already rejects
    // access === 'Disabled'), this never checked status — a suspended or
    // soft-deleted staff member could complete a fresh Google sign-in and
    // get a brand-new session regardless of admin action.
    if (teamRow.status !== 'active') {
      return NextResponse.json(
        { error: 'Your account is not active. Contact an administrator.' },
        { status: 403 },
      )
    }
    return respondWithUser({
      id:       teamRow.id,
      email:    teamRow.email,
      name:     teamRow.name,
      role:     teamRow.role,
      unit:     teamRow.unit,
      initials: teamRow.initials ?? '',
      isAdmin:  teamRow.is_admin ?? false,
      avatar:   payload.picture,
      userType: 'staff',
    })
  }

  // ── 2. Auto-provision for @gravissmarketing.com ──
  if (email.endsWith('@gravissmarketing.com')) {
    const name = payload.name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'
    const newId = `tm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const { data: newRow, error: insertErr } = await db
      .from('team_members')
      .insert({
        id: newId,
        name,
        email,
        role: 'Team Member',
        unit: 'Leadership/Admin',
        initials,
        status: 'active',
        is_admin: false,
      })
      .select('id, email, name, role, unit, initials, is_admin, status')
      .single()

    if (insertErr) {
      // Duplicate key — row exists, re-fetch
      if (insertErr.code === '23505') {
        const { data: existing } = await db
          .from('team_members')
          .select('id, email, name, role, unit, initials, is_admin, status')
          .ilike('email', email)
          .maybeSingle()
        if (existing) {
          return respondWithUser({
            id:       existing.id,
            email:    existing.email,
            name:     existing.name,
            role:     existing.role,
            unit:     existing.unit,
            initials: existing.initials ?? '',
            isAdmin:  existing.is_admin ?? false,
            avatar:   payload.picture,
            userType: 'staff',
          })
        }
      }
      throw new Error(`Could not create team profile: ${insertErr.message}`)
    }

    if (newRow) {
      return respondWithUser({
        id:       newRow.id,
        email:    newRow.email,
        name:     newRow.name,
        role:     newRow.role,
        unit:     newRow.unit,
        initials: newRow.initials ?? '',
        isAdmin:  newRow.is_admin ?? false,
        avatar:   payload.picture,
        userType: 'staff',
      })
    }
  }

  // ── 3. Check portal_clients (external clients) ──
  const { data: clientRow, error: clientErr } = await db
    .from('portal_clients')
    .select('id, email, company, contact, service, access')
    .ilike('email', email)
    .maybeSingle()

  if (clientErr) {
    throw new Error(`Database error while looking up portal account: ${clientErr.message}`)
  }

  if (!clientRow) {
    return NextResponse.json(
      { error: `No account found for ${email}. Contact Graviss Marketing to get access.` },
      { status: 403 },
    )
  }

  if (clientRow.access === 'Disabled') {
    return NextResponse.json(
      { error: 'Your portal access has been disabled. Contact Graviss Marketing.' },
      { status: 403 },
    )
  }

  const names = (clientRow.contact ?? '').split(' ')
  return respondWithUser({
    id:       clientRow.id,
    email:    clientRow.email,
    name:     clientRow.contact ?? clientRow.email,
    role:     'Client',
    unit:     'Client',
    initials: names.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL',
    isAdmin:  false,
    avatar:   payload.picture,
    userType: 'client',
    company:  clientRow.company,
  })
})
