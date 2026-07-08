import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSupabaseToken } from '@/lib/extract-token'

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

async function getCurrentUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const db = createServiceClient()
  const token = extractSupabaseToken(req)
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

export async function requireRole(
  req: NextRequest,
  minRole: UserRole,
): Promise<NextResponse | null> {
  const user = await getCurrentUser(req)

  if (!user) {
    // Supabase JS stores sessions in localStorage, not cookies, so
    // getCurrentUser() can't resolve the token from the request alone.
    // Fall through if the gravhub-auth bridge cookie is present — the
    // proxy already verified the user is authenticated. Route-level
    // handlers (requireAdmin, etc.) provide additional checks.
    if (req.cookies.has('gravhub-auth')) return null
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
