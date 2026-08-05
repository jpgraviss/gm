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
  if (await isLockedOut(normalizedEmail, security.loginAttempts)) {
    return NextResponse.json(
      { error: 'Too many failed attempts for this account. Please wait 30 minutes and try again.' },
      { status: 429 },
    )
  }

  const db = createServiceClient()
  const { data: member, error } = await db
    .from('team_members')
    .select('id, verification_code, verification_expires, setup_completed, status')
    .ilike('email', normalizedEmail)
    .single()

  if (error || !member) {
    return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
  }

  if (member.setup_completed) {
    return NextResponse.json({ error: 'Account setup has already been completed' }, { status: 400 })
  }

  // AUDIT.md #504 — a denied new hire (approve-setup's deny branch sets
  // status: 'suspended' but historically left the verification code live)
  // could resubmit the same still-valid code here and get pushed straight
  // back into the pending-approval queue with zero status check. Block it.
  if (member.status === 'suspended') {
    return NextResponse.json(
      { error: 'This account setup request was denied. Please contact your administrator.' },
      { status: 403 },
    )
  }

  if (!member.verification_code) {
    return NextResponse.json({ error: 'No verification code found. Request a new invite.' }, { status: 400 })
  }

  if (member.verification_expires && new Date(member.verification_expires) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Request a new invite.' }, { status: 400 })
  }

  if (member.verification_code !== code.toString().trim()) {
    await recordFailedAttempt(normalizedEmail)
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
  }

  await clearAttempts(normalizedEmail)
  const setupToken = crypto.randomBytes(32).toString('hex')

  // Note on AUDIT.md #504's second suggested fix ("null verification_code
  // here too, matching the portal-client sibling"): unlike
  // portal-clients/complete-setup — a single terminal call that verifies the
  // code AND sets the password AND is done — this team-member flow is two
  // separate calls sharing one code: this route only flips pending_approval,
  // and /api/auth/setup-account independently re-validates the *same* code
  // as its sole caller-authentication (there's no session yet) before it
  // will set a real password. Nulling the code here would make every
  // legitimate approved hire fail that second call. The code is correctly
  // single-used at the end of setup-account instead (that route already
  // nulls verification_code/verification_expires on success), which is
  // really the terminal step and true structural analog of complete-setup.
  // The true analog of *this* route is
  // portal-clients/verify-code, a pure gate-check that likewise leaves the
  // code intact. The status check above is what actually closes #504: a
  // denied account can no longer replay its way back into the pending queue
  // regardless of whether the code is still live.
  await db
    .from('team_members')
    .update({ pending_approval: true })
    .eq('id', member.id)

  return NextResponse.json({ success: true, setupToken, userId: member.id })
})
