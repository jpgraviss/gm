import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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

/**
 * Extract the current user from the request (cookie or bearer token).
 * Returns null if unauthenticated.
 */
async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const db = createServiceClient()

  // Bearer token
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // Supabase session cookie
  if (!token) {
    const sbCookie = req.cookies.getAll().find(c =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    )
    if (sbCookie) {
      try {
        const parsed = JSON.parse(Buffer.from(sbCookie.value, 'base64').toString())
        token = parsed?.access_token ?? parsed?.[0]?.access_token ?? null
      } catch {
        token = sbCookie.value || null
      }
    }
  }

  if (!token) return null

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user?.email) return null

  const { data: member } = await db
    .from('team_members')
    .select('id, name, email, role, unit, is_admin')
    .eq('email', user.email)
    .maybeSingle()

  if (!member) return null

  return {
    userId: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    unit: member.unit,
    isAdmin: member.is_admin ?? false,
  }
}

/**
 * Require the current user to have at least the given role. Returns a
 * NextResponse (to return from your handler) if access is denied, or
 * null if the user is authorized.
 *
 * Usage in API route:
 *   const denied = await requireRole(req, 'Leadership')
 *   if (denied) return denied
 */
export async function requireRole(
  req: NextRequest,
  minRole: UserRole,
): Promise<NextResponse | null> {
  const user = await getCurrentUser(req)

  // No user → fall through to the proxy's cookie check. If the gravhub-auth
  // bridge cookie is present the proxy already authenticated the request;
  // trust it for the minimum tier but still block privileged actions.
  if (!user) {
    const hasGravhub = req.cookies.has('gravhub-auth')
    if (!hasGravhub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Unknown user with cookie — only permit Team Member level and below
    if (roleLevel(minRole) > roleLevel('Team Member')) {
      return NextResponse.json({ error: 'Forbidden: role required' }, { status: 403 })
    }
    return null
  }

  if (user.isAdmin) return null // Super Admin short-circuit

  if (roleLevel(user.role) < roleLevel(minRole)) {
    return NextResponse.json(
      { error: `Forbidden: requires ${minRole} or higher` },
      { status: 403 },
    )
  }

  return null
}

/**
 * Load the current authenticated user for use inside a handler
 * (e.g. to scope a query by assigned_rep or to log who did what).
 * Returns null if no user can be identified.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  return getCurrentUser(req)
}
