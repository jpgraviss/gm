import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
  }
}

export async function GET(req: NextRequest) {
  const db = createServiceClient()
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === 'true'
  let query = db.from('team_members').select('*').order('name')
  if (!includeInactive) {
    query = query.eq('status', 'active')
  }
  const { data, error } = await query
  if (error) {
    console.error('[team-members GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch team members' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapMember))
}

export async function POST(req: NextRequest) {
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
    console.error('[team-members POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create team member' }, { status: 500 })
  }
  return NextResponse.json(mapMember(data), { status: 201 })
}

export async function PATCH(req: NextRequest) {
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
    console.error('[team-members PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update user status' }, { status: 500 })
  }
  return NextResponse.json(mapMember(data))
}
