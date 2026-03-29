import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
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
    console.error('[time-entries PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update time entry' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('time_entries').delete().eq('id', id)
  if (error) {
    console.error('[time-entries DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete time entry' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
