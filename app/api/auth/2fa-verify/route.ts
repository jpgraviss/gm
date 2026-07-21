import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyTwoFactorCode } from '@/lib/two-factor'
import { buildSessionCookie, sessionTimeoutToSeconds, type SessionPayload } from '@/lib/session-cookie'
import { getSecuritySettings } from '@/lib/settings'
import { isLockedOut, recordFailedAttempt, clearAttempts } from '@/lib/login-attempts'

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
  if (isLockedOut(normalizedEmail, security.loginAttempts)) {
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
    recordFailedAttempt(normalizedEmail)
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }
  clearAttempts(normalizedEmail)

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
  }, sessionTimeoutToSeconds(security.sessionTimeout)))
  return res
})
