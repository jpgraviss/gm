import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()
  // Map camelCase body keys to snake_case columns
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)                      update.status = body.status
  if (body.value !== undefined)                       update.value = body.value
  if (body.assignedRep !== undefined)                 update.assigned_rep = body.assignedRep
  if (body.items !== undefined)                       update.items = body.items
  if (body.sentDate !== undefined)                    update.sent_date = body.sentDate
  if (body.viewedDate !== undefined)                  update.viewed_date = body.viewedDate
  if (body.respondedDate !== undefined)               update.responded_date = body.respondedDate
  if (body.submittedForApprovalDate !== undefined)    update.submitted_for_approval_date = body.submittedForApprovalDate
  if (body.approvedBy !== undefined)                  update.approved_by = body.approvedBy
  if (body.approvedDate !== undefined)                update.approved_date = body.approvedDate
  if (body.rejectedBy !== undefined)                  update.rejected_by = body.rejectedBy
  if (body.rejectedDate !== undefined)                update.rejected_date = body.rejectedDate

  const { data, error } = await db.from('proposals').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[proposals/:id PATCH]', error)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }

  // Fire automation triggers on status changes
  if (body.status === 'Accepted') {
    fireAutomations('proposal_accepted', { proposalId: id, ...data })
  } else if (body.status === 'Declined') {
    fireAutomations('proposal_declined', { proposalId: id, ...data })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('proposals').delete().eq('id', id)
  if (error) {
    console.error('[proposals/:id DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
