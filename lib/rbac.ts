import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSupabaseToken } from '@/lib/extract-token'
import { verifySessionCookie } from '@/lib/session-cookie'
import { getSecuritySettings } from '@/lib/settings'
import { getClientIp } from '@/lib/request-ip'

/**
 * Role hierarchy — higher roles inherit the permissions of lower roles.
 * Index = power level. Higher index = more power.
 */
const ROLE_HIERARCHY = [
  'Client',           // 0 — client portal only
  'Contractor',       // 1 — limited read access to assigned projects
  'Team Member',      // 2 — CRUD on own records
  'Dept Manager',     // 3 — CRUD within unit
  'Department Manager', // 3 — alias
  'Leadership',       // 4 — CRUD across units
  'Super Admin',      // 5 — all access
] as const

export type UserRole = typeof ROLE_HIERARCHY[number]

function roleLevel(role: string | null | undefined): number {
  if (!role) return -1
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole)
  return idx >= 0 ? idx : -1
}

export interface AuthenticatedUser {
  userId: string
  email: string
  name: string
  role: string
  unit: string
  isAdmin: boolean
}

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

async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const db = createServiceClient()
  const email = await resolveVerifiedEmail(req)
  if (!email) return null

  const { data: member } = await db
    .from('team_members')
    .select('id, name, email, role, unit, is_admin, status, access_schedule')
    .eq('email', email)
    .maybeSingle()

  // A suspended/soft-deleted staff member's team_members row previously
  // stayed matchable here forever — status was fetched nowhere in this
  // function, so an existing session (or a fresh sign-in) kept full access
  // for as long as it lived, regardless of admin action.
  if (!member || member.status !== 'active') return null

  // AUDIT.md #208 — the "Schedule Access" admin modal explicitly claims
  // "the system will automatically enforce these windows," but
  // access_schedule was previously only ever read by AuthContext's
  // client-side redirect — this is the real server-side gate behind every
  // requireRole/requireAdmin call, and it never checked it at all. A user
  // whose access was "scheduled for removal" kept full API access for as
  // long as their existing cookie lived, enforced nowhere except a
  // client-side redirect a user can simply avoid triggering.
  const schedule = member.access_schedule as { removeAccessOn?: string; reinstateOn?: string } | null
  if (schedule?.removeAccessOn) {
    const now = Date.now()
    const removeAt = new Date(schedule.removeAccessOn).getTime()
    const reinstateAt = schedule.reinstateOn ? new Date(schedule.reinstateOn).getTime() : null
    if (removeAt <= now && (!reinstateAt || reinstateAt > now)) {
      return null
    }
  }

  // AUDIT.md #207 — IP Restriction previously had zero enforcement.
  // Deliberately checked here (requireRole/getAuthUser) and NOT in
  // lib/admin-auth.ts's requireAdmin — an admin misconfiguring this list
  // (a typo, a changed office IP) must always retain a way into Settings
  // to fix it, or the org locks itself out with no recovery path short of
  // direct DB access. is_admin callers are exempt from the same reasoning:
  // requireRole's own `if (user.isAdmin) return null` bypass would be
  // pointless to protect against here if getCurrentUser already blocked
  // them from ever reaching that check.
  const security = await getSecuritySettings()
  if (security.ipRestriction !== 'disabled' && !member.is_admin) {
    const allowedIps = security.ipRestriction.split(',').map(ip => ip.trim()).filter(Boolean)
    const callerIp = getClientIp(req)
    if (allowedIps.length > 0 && !allowedIps.includes(callerIp)) {
      return null
    }
  }

  return {
    userId: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    unit: member.unit,
    isAdmin: member.is_admin ?? false,
  }
}

export async function requireRole(
  req: NextRequest,
  minRole: UserRole,
): Promise<NextResponse | null> {
  const user = await getCurrentUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.isAdmin) return null

  if (roleLevel(user.role) < roleLevel(minRole)) {
    return NextResponse.json(
      { error: `Forbidden: requires ${minRole} or higher` },
      { status: 403 },
    )
  }

  return null
}

export async function getAuthUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  return getCurrentUser(req)
}
