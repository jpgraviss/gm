import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'

const APPROVAL_FIELDS = ['approvalStatus', 'approvedBy', 'approvedAt', 'rejectionNote']

export const PATCH = withErrorHandler('time-entries/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  // Approval fields have their own bulk endpoint gated at Dept Manager
  // (POST /api/time-entries) — this single-entry PATCH previously let any
  // Team Member self-approve/reject their own (or anyone's) time entry by
  // setting these fields directly, completely bypassing that gate.
  if (APPROVAL_FIELDS.some(f => body[f] !== undefined)) {
    const approveDenied = await requireRole(req, 'Dept Manager')
    if (approveDenied) return approveDenied
  }
  const result = validate(body, {
    date: { type: 'string', maxLength: 20 },
    description: { type: 'string', maxLength: 1000 },
    teamMember: { type: 'string', maxLength: 200 },
    hours: { type: 'number', min: 0, max: 24 },
    minutes: { type: 'number', min: 0, max: 59 },
    // AUDIT #261 — this route set approval_status straight through with no
    // enum validation, unlike the bulk endpoint (POST /api/time-entries),
    // which correctly validates it. An arbitrary string here falls back to
    // "pending" styling in ApprovalBadge and won't match the bulk-approvals
    // filter.
    approvalStatus: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()

  // No ownership check previously existed here — any Team Member (the
  // lowest staff tier, per requireRole above) could edit or delete any
  // other team member's logged hours, or repoint `teamMember` to reassign
  // an entry to someone else's name. Dept Manager+ (the same tier the bulk
  // approve endpoint and this file's own APPROVAL_FIELDS gate above use)
  // retain override ability for legitimate correction/backfill workflows —
  // matches app/time-tracking/page.tsx's own `canApprove` check.
  const { data: existingEntry, error: existingErr } = await db
    .from('time_entries')
    .select('team_member')
    .eq('id', id)
    .single()
  if (existingErr || !existingEntry) {
    return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
  }

  const canManageOthers = (await requireRole(req, 'Dept Manager')) === null
  if (!canManageOthers) {
    const caller = await getAuthUser(req)
    const callerName = (caller?.name ?? '').trim().toLowerCase()
    const ownerName = (existingEntry.team_member ?? '').trim().toLowerCase()
    if (!callerName || callerName !== ownerName) {
      return NextResponse.json({ error: 'You can only edit your own time entries' }, { status: 403 })
    }
    if (body.teamMember !== undefined && String(body.teamMember).trim().toLowerCase() !== ownerName) {
      return NextResponse.json({ error: 'You cannot reassign a time entry to another team member' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = {}
  if (body.date !== undefined)        update.date = body.date
  if (body.description !== undefined) update.description = body.description
  if (body.teamMember !== undefined)  update.team_member = body.teamMember
  if (body.serviceType !== undefined) update.service_type = body.serviceType
  if (body.hours !== undefined)       update.hours = body.hours
  if (body.minutes !== undefined)     update.minutes = body.minutes
  if (body.billable !== undefined)    update.billable = body.billable
  if (body.projectId !== undefined)   update.project_id = body.projectId
  if (body.projectName !== undefined) update.project_name = body.projectName
  if (body.approvalStatus !== undefined)  update.approval_status = body.approvalStatus
  if (body.approvedBy !== undefined)      update.approved_by = body.approvedBy
  if (body.approvedAt !== undefined)      update.approved_at = body.approvedAt
  if (body.rejectionNote !== undefined)   update.rejection_note = body.rejectionNote

  const { data, error } = await db.from('time_entries').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update time entry')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('time-entries/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()

  // Same ownership gate as PATCH above — a plain Team Member could
  // otherwise delete any other team member's logged hours.
  const { data: existingEntry, error: existingErr } = await db
    .from('time_entries')
    .select('team_member')
    .eq('id', id)
    .single()
  if (existingErr || !existingEntry) {
    return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
  }

  const canManageOthers = (await requireRole(req, 'Dept Manager')) === null
  if (!canManageOthers) {
    const caller = await getAuthUser(req)
    const callerName = (caller?.name ?? '').trim().toLowerCase()
    const ownerName = (existingEntry.team_member ?? '').trim().toLowerCase()
    if (!callerName || callerName !== ownerName) {
      return NextResponse.json({ error: 'You can only delete your own time entries' }, { status: 403 })
    }
  }

  const { error } = await db.from('time_entries').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete time entry')
  }
  return NextResponse.json({ deleted: id })
})
