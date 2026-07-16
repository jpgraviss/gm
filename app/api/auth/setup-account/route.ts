import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('auth/setup-account POST', async (req) => {
  const { email, code, password, avatarUrl } = await req.json()

  if (!email || !code || !password) {
    return NextResponse.json({ error: 'Email, verification code, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = createServiceClient()
  const normalizedEmail = email.toLowerCase().trim()
  const { data: member, error: memberErr } = await db
    .from('team_members')
    .select('id, email, setup_completed, status, pending_approval, verification_code, verification_expires')
    .ilike('email', normalizedEmail)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (member.setup_completed) {
    return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 400 })
  }

  // Re-validate the verification code server-side — this route is the one
  // that actually sets a real password, so it must independently prove the
  // caller received the invite email, not just trust a client-supplied
  // team_members.id (which the previous version did — anyone who obtained
  // or guessed an id, e.g. from an authenticated GET /api/team-members
  // response, could set that account's password directly).
  if (!member.verification_code || member.verification_code !== String(code).trim()) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }
  if (member.verification_expires && new Date(member.verification_expires) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Please contact your administrator for a new invite.' }, { status: 400 })
  }

  if (member.status !== 'active') {
    return NextResponse.json({ error: 'Account is not active.' }, { status: 403 })
  }

  if (member.pending_approval) {
    return NextResponse.json({ error: 'Account has not been approved yet. Please wait for admin approval.' }, { status: 403 })
  }

  const { error: pwError } = await db.auth.admin.updateUserById(member.id, {
    password,
  })

  if (pwError) {
    throw new Error('Failed to set password')
  }

  const updates: Record<string, unknown> = {
    setup_completed: true,
    verification_code: null,
    verification_expires: null,
    pending_approval: false,
  }

  if (avatarUrl) {
    updates.avatar_url = avatarUrl
  }

  await db.from('team_members').update(updates).eq('id', member.id)

  return NextResponse.json({ success: true, userId: member.id })
})
