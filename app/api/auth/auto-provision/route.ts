// Auto-provision a team_members row for authenticated Supabase Auth users
// that don't yet have a profile. Only works for @gravissmarketing.com emails.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('auth/auto-provision POST', async (req) => {
  const { email } = await req.json()
  if (!email || !email.endsWith('@gravissmarketing.com')) {
    return NextResponse.json({ error: 'Not eligible for auto-provision' }, { status: 403 })
  }

  const db = createServiceClient()
  const emailLower = email.toLowerCase()

  // Sits under proxy.ts's public /api/auth/ prefix with no caller anywhere
  // in the app (google-verify does its own inline, properly-verified
  // provisioning instead) — but being unreachable from the UI doesn't make
  // a live, unauthenticated endpoint safe: anyone could still POST here
  // directly to re-provision an active team_members row for any
  // @gravissmarketing.com address that still has a live Supabase Auth
  // user, even one an admin had deliberately deleted from team_members.
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { data: { user: verifiedUser }, error: tokenErr } = await db.auth.getUser(token)
  if (tokenErr || !verifiedUser?.email || verifiedUser.email.toLowerCase() !== emailLower) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Check if a profile already exists
  const { data: existing } = await db
    .from('team_members')
    .select('id')
    .eq('email', emailLower)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ status: 'already_exists' })
  }

  // Look up the Supabase Auth user to get their UUID
  const { data: { users }, error: listErr } = await db.auth.admin.listUsers()
  if (listErr) {
    throw new Error(listErr?.message || 'Failed to list users')
  }
  const authUser = users?.find(u => u.email?.toLowerCase() === emailLower)
  if (!authUser) {
    return NextResponse.json({ error: 'No auth user found' }, { status: 404 })
  }

  // Derive a name and initials from the email or user metadata
  const metaName = authUser.user_metadata?.name as string | undefined
  const name = metaName || emailLower.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3) || 'GM'

  const { error: insertErr } = await db.from('team_members').insert({
    id:       authUser.id,
    name,
    email:    emailLower,
    role:     'Team Member',
    unit:     'Leadership/Admin',
    initials,
    status:   'active',
    is_admin: false,
  })

  if (insertErr) {
    throw new Error(insertErr.message)
  }

  return NextResponse.json({ status: 'provisioned', name })
})
