import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getSecuritySettings } from '@/lib/settings'
import { isLockedOut, recordFailedAttempt, clearAttempts } from '@/lib/login-attempts'

export const POST = withErrorHandler('auth/verify-code POST', async (req) => {
  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // AUDIT.md #207 — same account-level lockout as the portal-client
  // equivalent, on top of the existing IP throttle (proxy.ts).
  const security = await getSecuritySettings()
  if (isLockedOut(normalizedEmail, security.loginAttempts)) {
    return NextResponse.json(
      { error: 'Too many failed attempts for this account. Please wait 30 minutes and try again.' },
      { status: 429 },
    )
  }

  const db = createServiceClient()
  const { data: member, error } = await db
    .from('team_members')
    .select('id, verification_code, verification_expires, setup_completed')
    .ilike('email', normalizedEmail)
    .single()

  if (error || !member) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
  }

  if (member.setup_completed) {
    return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 400 })
  }

  if (!member.verification_code) {
    return NextResponse.json({ error: 'No verification code found. Request a new invite.' }, { status: 400 })
  }

  if (member.verification_expires && new Date(member.verification_expires) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Request a new invite.' }, { status: 400 })
  }

  if (member.verification_code !== code.toString().trim()) {
    recordFailedAttempt(normalizedEmail)
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  clearAttempts(normalizedEmail)
  const setupToken = crypto.randomBytes(32).toString('hex')

  await db
    .from('team_members')
    .update({ pending_approval: true })
    .eq('id', member.id)

  return NextResponse.json({ success: true, setupToken, userId: member.id })
})
