import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROPOSAL_STATUSES } from '@/lib/validation'
import { fireAutomations } from '@/lib/automations-engine'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProposal(row: any) {
  return {
    id:                         row.id,
    dealId:                     row.deal_id ?? '',
    company:                    row.company,
    status:                     row.status,
    value:                      row.value,
    serviceType:                row.service_type,
    assignedRep:                row.assigned_rep,
    items:                      row.items ?? [],
    isRenewal:                  row.is_renewal ?? false,
    internalOnly:               row.internal_only ?? false,
    renewalNotes:               row.renewal_notes ?? undefined,
    sentDate:                   row.sent_date ?? undefined,
    viewedDate:                 row.viewed_date ?? undefined,
    respondedDate:              row.responded_date ?? undefined,
    submittedForApprovalDate:   row.submitted_for_approval_date ?? undefined,
    approvedBy:                 row.approved_by ?? undefined,
    approvedDate:               row.approved_date ?? undefined,
    rejectedBy:                 row.rejected_by ?? undefined,
    rejectedDate:               row.rejected_date ?? undefined,
    createdDate:                row.created_date ?? '',
  }
}

export const PATCH = withErrorHandler('proposals/[id] PATCH', async (req, ctx) => {
  const { id } = await ctx!.params
  const body = await req.json()

  // Input validation
  const result = validate(body, {
    status:      { type: 'string', enum: [...PROPOSAL_STATUSES] },
    value:       { type: 'number', min: 0, max: 100_000_000 },
    company:     { type: 'string', maxLength: 200 },
    serviceType: { type: 'string', maxLength: 100 },
    assignedRep: { type: 'string', maxLength: 200 },
    items:       { type: 'array' },
    approvedBy:  { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // Map camelCase body keys to snake_case columns
  const update: Record<string, unknown> = {}
  if (body.status !== undefined)                      update.status = body.status
  if (body.value !== undefined)                       update.value = body.value
  if (body.company !== undefined)                     update.company = body.company
  if (body.serviceType !== undefined)                 update.service_type = body.serviceType
  if (body.assignedRep !== undefined)                 update.assigned_rep = body.assignedRep
  if (body.items !== undefined)                       update.items = body.items
  if (body.isRenewal !== undefined)                   update.is_renewal = body.isRenewal
  if (body.internalOnly !== undefined)                update.internal_only = body.internalOnly
  if (body.renewalNotes !== undefined)                update.renewal_notes = body.renewalNotes
  if (body.sentDate !== undefined)                    update.sent_date = body.sentDate
  if (body.viewedDate !== undefined)                  update.viewed_date = body.viewedDate
  if (body.respondedDate !== undefined)               update.responded_date = body.respondedDate
  if (body.submittedForApprovalDate !== undefined)    update.submitted_for_approval_date = body.submittedForApprovalDate
  if (body.approvedBy !== undefined)                  update.approved_by = body.approvedBy
  if (body.approvedDate !== undefined)                update.approved_date = body.approvedDate
  if (body.rejectedBy !== undefined)                  update.rejected_by = body.rejectedBy
  if (body.rejectedDate !== undefined)                update.rejected_date = body.rejectedDate

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('proposals').update(update).eq('id', id).select().single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }
    throw new Error(error?.message || 'Failed to update proposal')
  }

  // Fire automation triggers on status changes
  if (body.status === 'Accepted') {
    fireAutomations('proposal_accepted', { proposalId: id, ...data })
  } else if (body.status === 'Declined') {
    fireAutomations('proposal_declined', { proposalId: id, ...data })
  }

  if (body.status !== undefined) {
    logAudit({ userName: 'system', action: 'proposal_status_changed', module: 'proposals', type: 'action', metadata: { proposalId: id, newStatus: body.status } })
  }

  return NextResponse.json(mapProposal(data))
})

export const DELETE = withErrorHandler('proposals/[id] DELETE', async (req, ctx) => {
  const { id } = await ctx!.params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const db = createServiceClient()
  const { error } = await db.from('proposals').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete proposal')
  }
  logAudit({ userName: 'system', action: 'deleted_proposal', module: 'proposals', type: 'warning', metadata: { proposalId: id } })
  return NextResponse.json({ deleted: id })
})
