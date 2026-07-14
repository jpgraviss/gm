import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMember(row: any) {
  return {
    id:              row.id,
    name:            row.name,
    email:           row.email,
    role:            row.role,
    unit:            row.unit ?? 'Delivery/Operations',
    initials:        row.initials ?? '',
    status:          row.status ?? 'active',
    isAdmin:         row.is_admin ?? false,
    lastLogin:       row.last_login ?? null,
    suspendedAt:     row.suspended_at ?? null,
    suspendedUntil:  row.suspended_until ?? null,
    suspendedReason: row.suspended_reason ?? null,
    accessSchedule:  row.access_schedule ?? null,
    deletedAt:       row.deleted_at ?? null,
    pendingApproval: row.pending_approval ?? false,
    setupCompleted:  row.setup_completed ?? false,
    emailSignature:  row.email_signature ?? null,
  }
}

export const GET = withErrorHandler('team-members GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const db = createServiceClient()
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'
  let query = db.from('team_members').select('*').order('name')
  if (!includeInactive) {
    query = query.eq('status', 'active')
  }
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch team members')
  }
  return NextResponse.json((data ?? []).map(mapMember))
})

export const POST = withErrorHandler('team-members POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Super Admin')
  if (denied) return denied
  const body = await req.json()
  const db = createServiceClient()
  const initials = body.initials ?? body.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const { data, error } = await db
    .from('team_members')
    .insert({
      id:       `tm-${Date.now()}`,
      name:     body.name,
      email:    body.email,
      role:     body.role ?? 'Team Member',
      unit:     body.unit ?? 'Leadership/Admin',
      initials: initials,
      status:   body.status ?? 'active',
      is_admin: body.isAdmin ?? false,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create team member')
  }
  return NextResponse.json(mapMember(data), { status: 201 })
})

export const PATCH = withErrorHandler('team-members PATCH', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Super Admin')
  if (denied) return denied
  const body = await req.json()
  const { id, action, reason, suspendUntil, accessSchedule } = body as {
    id: string
    action: 'suspend' | 'reinstate' | 'delete' | 'schedule_access'
    reason?: string
    suspendUntil?: string
    accessSchedule?: { removeAccessOn?: string; reinstateOn?: string }
  }

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const update: Record<string, unknown> = {}

  if (action === 'suspend') {
    update.status = 'suspended'
    update.suspended_at = new Date().toISOString()
    update.suspended_reason = reason ?? null
    update.suspended_until = suspendUntil ?? null
  } else if (action === 'reinstate') {
    update.status = 'active'
    update.suspended_at = null
    update.suspended_until = null
    update.suspended_reason = null
    update.deleted_at = null
    update.access_schedule = null
  } else if (action === 'delete') {
    update.status = 'deleted'
    update.deleted_at = new Date().toISOString()
  } else if (action === 'schedule_access') {
    update.access_schedule = accessSchedule ?? null
  }

  const { data, error } = await db.from('team_members').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update user status')
  }
  return NextResponse.json(mapMember(data))
})
