import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const PATCH = withErrorHandler('time-entries/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const result = validate(body, {
    date: { type: 'string', maxLength: 20 },
    description: { type: 'string', maxLength: 1000 },
    teamMember: { type: 'string', maxLength: 200 },
    hours: { type: 'number', min: 0, max: 24 },
    minutes: { type: 'number', min: 0, max: 59 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
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
  const { error } = await db.from('time_entries').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete time entry')
  }
  return NextResponse.json({ deleted: id })
})
