import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getSecuritySettings } from '@/lib/settings'
import { isLockedOut, recordFailedAttempt, clearAttempts } from '@/lib/login-attempts'

export const POST = withErrorHandler('portal-clients/verify-code POST', async (req) => {
  const { email, code } = await req.json()
  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // AUDIT.md #207 — "Login Attempts" had zero enforcement. This code is
  // already IP-throttled (#198); this adds account-level lockout too, since
  // an attacker distributing guesses across IPs would otherwise bypass that
  // throttle entirely for one target account.
  const security = await getSecuritySettings()
  if (isLockedOut(normalizedEmail, security.loginAttempts)) {
    return NextResponse.json(
      { error: 'Too many failed attempts for this account. Please wait 30 minutes and try again.' },
      { status: 429 },
    )
  }

  const db = createServiceClient()

  const { data: client, error } = await db
    .from('portal_clients')
    .select('id, verification_code, verification_expires')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (error || !client) {
    return NextResponse.json({ error: 'No portal account found for this email' }, { status: 404 })
  }

  if (!client.verification_code) {
    return NextResponse.json({ error: 'No verification code has been issued' }, { status: 400 })
  }

  if (client.verification_expires && new Date(client.verification_expires) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Please contact your administrator for a new invite.' }, { status: 400 })
  }

  if (client.verification_code !== code.trim()) {
    recordFailedAttempt(normalizedEmail)
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  clearAttempts(normalizedEmail)
  return NextResponse.json({ success: true, clientId: client.id })
})
