import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSupabaseToken } from '@/lib/extract-token'
import { verifySessionCookie } from '@/lib/session-cookie'

/**
 * Resolves the caller's verified email from either a real Supabase access
 * token or the signed gravhub-auth session cookie. Both are cryptographically
 * verified (Supabase validates the JWT; the cookie's HMAC is checked) — this
 * never trusts an unsigned/forgeable value.
 */
async function resolveVerifiedEmail(req: NextRequest): Promise<string | null> {
  const db = createServiceClient()
  const token = extractSupabaseToken(req)
  if (token) {
    const { data: { user }, error } = await db.auth.getUser(token)
    if (!error && user?.email) return user.email.toLowerCase()
  }

  const session = await verifySessionCookie(req.cookies.get('gravhub-auth')?.value)
  return session?.email.toLowerCase() ?? null
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const db = createServiceClient()
  const email = await resolveVerifiedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member } = await db
    .from('team_members')
    .select('is_admin, status, access_schedule')
    .eq('email', email)
    .single()

  // A suspended/deleted admin keeps a cryptographically valid session (or
  // can complete a fresh sign-in — status is only checked here) for as long
  // as the cookie lives unless this is enforced at the identity layer, not
  // just is_admin.
  if (!member?.is_admin || member.status !== 'active') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  // AUDIT.md #208 — mirrors the same access_schedule enforcement added to
  // lib/rbac.ts's getCurrentUser(); this is a separate identity-resolution
  // path (requireAdmin), not layered on top of that one, so it needs its
  // own check or a scheduled-removal admin could still pass every
  // requireAdmin-gated route.
  const schedule = member.access_schedule as { removeAccessOn?: string; reinstateOn?: string } | null
  if (schedule?.removeAccessOn) {
    const now = Date.now()
    const removeAt = new Date(schedule.removeAccessOn).getTime()
    const reinstateAt = schedule.reinstateOn ? new Date(schedule.reinstateOn).getTime() : null
    if (removeAt <= now && (!reinstateAt || reinstateAt > now)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }
  }

  return null
}

export async function getAuthenticatedEmail(req: NextRequest): Promise<string | null> {
  return resolveVerifiedEmail(req)
}
