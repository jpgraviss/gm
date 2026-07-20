import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { buildSessionCookie } from '@/lib/session-cookie'

export const POST = withErrorHandler('portal-clients/magic-link/verify POST', async (req) => {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: tokenRow, error: tokenErr } = await db
    .from('portal_magic_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .maybeSingle()

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    await db.from('portal_magic_tokens').update({ used: true }).eq('id', tokenRow.id)
    return NextResponse.json({ error: 'This link has expired. Please request a new one.' }, { status: 401 })
  }

  await db.from('portal_magic_tokens').update({ used: true }).eq('id', tokenRow.id)

  const { data: client } = await db
    .from('portal_clients')
    .select('id, email, company, contact, service, access, portal_role, portal_config, pending_approval')
    .eq('id', tokenRow.portal_client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })
  }

  if (client.access === 'Disabled') {
    return NextResponse.json({ error: 'Your portal access has been disabled' }, { status: 403 })
  }

  // AUDIT.md #195 — this route previously always flipped `access` to
  // 'Active' on any successful token redemption, regardless of
  // pending_approval — a client who self-served through setup (pending
  // admin sign-off) could get themselves fully activated via any magic
  // link they held, bypassing the approval step entirely. Admin-issued
  // invites (the normal way a magic link is created) never set
  // pending_approval in the first place, so this only blocks the specific
  // self-serve-pending case, not the regular invite flow.
  if (client.pending_approval) {
    return NextResponse.json({ error: 'Your portal access is awaiting admin approval. You will receive an email once approved.' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]
  await db.from('portal_clients').update({ last_login: today, access: 'Active' }).eq('id', client.id)

  const names = (client.contact ?? '').split(' ')
  logAudit({ userName: client.contact || client.email, action: 'portal_magic_link_login', module: 'portal', type: 'info', metadata: { email: client.email, company: client.company } })

  const user = {
    id:       client.id,
    email:    client.email,
    name:     client.contact ?? client.email,
    role:     'Client',
    unit:     'Client',
    initials: names.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL',
    isAdmin:  false,
    userType: 'client' as const,
    company:  client.company,
  }

  const res = NextResponse.json({ user })
  res.cookies.set(await buildSessionCookie({
    id: user.id,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    userType: user.userType,
  }))
  return res
})
