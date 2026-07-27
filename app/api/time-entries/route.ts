import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(row: any) {
  return {
    id:          row.id,
    date:        row.date,
    projectId:   row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    description: row.description,
    teamMember:  row.team_member,
    serviceType: row.service_type,
    hours:       row.hours,
    minutes:     row.minutes,
    billable:    row.billable,
    approvalStatus: row.approval_status ?? 'pending',
    approvedBy:     row.approved_by ?? undefined,
    approvedAt:     row.approved_at ?? undefined,
    rejectionNote:  row.rejection_note ?? undefined,
  }
}

export const GET = withErrorHandler('time-entries GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const weekStart = searchParams.get('weekStart')
  const weekEnd   = searchParams.get('weekEnd')
  const member    = searchParams.get('member')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('time_entries')
    .select('*')
  if (weekStart) query = query.gte('date', weekStart)
  if (weekEnd)   query = query.lte('date', weekEnd)
  if (member)    query = query.eq('team_member', member)
  const approvalStatus = searchParams.get('approval_status')
  if (approvalStatus) query = query.eq('approval_status', approvalStatus)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch time entries')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapEntry), nextCursor)
})

export const PATCH = withErrorHandler('time-entries PATCH', async (req: NextRequest) => {
  // Bulk approve/reject — matches the UI's own gate (isAdmin || Dept
  // Manager), which was previously client-side only. Uses 'Dept Manager'
  // (not the 'Department Manager' alias one index higher in
  // ROLE_HIERARCHY) to match the real stored role value — see the admin
  // role dropdown in app/admin/page.tsx.
  const denied = await requireRole(req, 'Dept Manager')
  if (denied) return denied

  const body = await req.json()
  const { ids, approvalStatus, approvedBy, rejectionNote } = body as {
    ids: string[]
    approvalStatus: string
    approvedBy?: string
    rejectionNote?: string
  }

  if (!ids?.length || !approvalStatus) {
    return NextResponse.json({ error: 'ids and approvalStatus are required' }, { status: 400 })
  }
  if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
    return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 })
  }

  const db = createServiceClient()
  const update: Record<string, unknown> = {
    approval_status: approvalStatus,
  }
  if (approvedBy)     update.approved_by = approvedBy
  if (rejectionNote)  update.rejection_note = rejectionNote
  if (approvalStatus === 'approved' || approvalStatus === 'rejected') {
    update.approved_at = new Date().toISOString()
  }

  const { data, error } = await db
    .from('time_entries')
    .update(update)
    .in('id', ids)
    .select()

  if (error) {
    throw new Error(error?.message || 'Failed to bulk update')
  }
  return NextResponse.json((data ?? []).map(mapEntry))
})

export const POST = withErrorHandler('time-entries POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    date: { required: true, type: 'string', maxLength: 20 },
    description: { required: true, type: 'string', maxLength: 1000 },
    teamMember: { required: true, type: 'string', maxLength: 200 },
    hours: { type: 'number', min: 0, max: 24 },
    minutes: { type: 'number', min: 0, max: 59 },
  })
  if (!result.valid) return validationError(result.error)
  const hours = body.hours ?? 0
  const minutes = body.minutes ?? 0
  if (hours === 0 && minutes === 0) {
    return validationError('Duration must be greater than zero')
  }

  // `body.teamMember` was previously trusted verbatim — any Team Member
  // could submit hours attributed to a different named colleague. Same
  // Dept Manager+ override tier as the PATCH/DELETE ownership checks on
  // /api/time-entries/[id] (legitimate backfill workflow); a plain Team
  // Member can only log time for themselves.
  const canManageOthers = (await requireRole(req, 'Dept Manager')) === null
  if (!canManageOthers) {
    const caller = await getAuthUser(req)
    const callerName = (caller?.name ?? '').trim().toLowerCase()
    const requestedName = String(body.teamMember ?? '').trim().toLowerCase()
    if (!callerName || requestedName !== callerName) {
      return NextResponse.json({ error: 'You can only log time for yourself' }, { status: 403 })
    }
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('time_entries')
    .insert({
      id:           `te-${Date.now()}`,
      date:         body.date,
      project_id:   body.projectId ?? null,
      project_name: body.projectName ?? null,
      description:  body.description ?? '',
      team_member:  body.teamMember ?? '',
      service_type: body.serviceType ?? 'General',
      hours:        body.hours ?? 0,
      minutes:      body.minutes ?? 0,
      billable:     body.billable ?? true,
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create time entry')
  }
  return NextResponse.json(mapEntry(data), { status: 201 })
})
