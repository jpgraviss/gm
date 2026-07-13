import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError, CONTRACT_STATUSES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'

// Valid status transitions — keys are current status, values are allowed next statuses
const VALID_TRANSITIONS: Record<string, string[]> = {
  'Draft':              ['Sent', 'Expired', 'Terminated'],
  'Sent':               ['Viewed', 'Signed by Client', 'Expired', 'Terminated'],
  'Viewed':             ['Signed by Client', 'Expired', 'Terminated'],
  'Signed by Client':   ['Countersign Needed', 'Fully Executed', 'Expired', 'Terminated'],
  'Countersign Needed': ['Fully Executed', 'Expired', 'Terminated'],
  'Fully Executed':     ['Expired', 'Terminated'],
  'Expired':            ['Draft'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContract(row: any) {
  return {
    id:               row.id,
    proposalId:       row.proposal_id ?? undefined,
    companyId:        row.company_id || null,
    company:          row.company,
    status:           row.status,
    value:            row.value,
    billingStructure: row.billing_structure,
    startDate:        row.start_date ?? '',
    duration:         row.duration,
    renewalDate:      row.renewal_date ?? '',
    assignedRep:      row.assigned_rep,
    serviceType:      row.service_type,
    clientSigned:     row.client_signed ?? undefined,
    internalSigned:   row.internal_signed ?? undefined,
    terminatedReason: row.terminated_reason ?? undefined,
    terminatedDate:   row.terminated_date ?? undefined,
  }
}

export const PATCH = withErrorHandler('contracts/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid contract id' }, { status: 400 })
  }

  const body = await req.json()

  // Validate input fields
  const result = validate(body, {
    status:           { type: 'string', enum: [...CONTRACT_STATUSES] },
    value:            { type: 'number', min: 0, max: 100_000_000 },
    assignedRep:      { type: 'string', maxLength: 200 },
    billingStructure: { type: 'string', enum: ['Monthly', 'Quarterly', 'Annual', 'One-time', 'Custom'] },
    clientSigned:     { type: 'string', maxLength: 30 },
    internalSigned:   { type: 'string', maxLength: 30 },
    renewalDate:      { type: 'string', maxLength: 30 },
    terminatedReason: { type: 'string', maxLength: 1000 },
    terminatedDate:   { type: 'string', maxLength: 30 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // Fetched unconditionally (not just on a status change) — the portal
  // client's own Approvals page calls this route directly by id, so
  // requirePortalClient below needs the contract's real company to confirm
  // the caller is either staff or a client scoped to that same company,
  // closing a gap where any authenticated caller (including a portal
  // client for a different company) could otherwise PATCH any contract.
  const { data: current, error: fetchErr } = await db
    .from('contracts')
    .select('status, company')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const denied = await requirePortalClient(req, current.company)
  if (denied) return denied

  // If status is being changed, validate the transition
  if (body.status !== undefined) {
    const allowed = VALID_TRANSITIONS[current.status]
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status transition: ${current.status} → ${body.status}` },
        { status: 400 }
      )
    }
  }

  const update: Record<string, unknown> = {}
  if (body.status !== undefined)            update.status = body.status
  if (body.value !== undefined)             update.value = body.value
  if (body.clientSigned !== undefined)      update.client_signed = body.clientSigned
  if (body.internalSigned !== undefined)    update.internal_signed = body.internalSigned
  if (body.assignedRep !== undefined)       update.assigned_rep = body.assignedRep
  if (body.billingStructure !== undefined)  update.billing_structure = body.billingStructure
  if (body.renewalDate !== undefined)       update.renewal_date = body.renewalDate
  if (body.terminatedReason !== undefined)  update.terminated_reason = body.terminatedReason
  if (body.terminatedDate !== undefined)    update.terminated_date = body.terminatedDate
  if (body.companyId !== undefined)         update.company_id = body.companyId

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await db.from('contracts').update(update).eq('id', id).select().single()
  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }
    throw new Error(error?.message || 'Failed to update contract')
  }

  if (body.status === 'Fully Executed') {
    fireAutomations('contract_executed', { contractId: id, ...data })
  } else if (body.status === 'Sent') {
    fireAutomations('contract_sent', { contractId: id, ...data })
  }

  if (body.status !== undefined) {
    logAudit({ userName: 'system', action: 'contract_status_changed', module: 'contracts', type: 'action', metadata: { contractId: id, newStatus: body.status } })
  }

  return NextResponse.json(mapContract(data))
})

export const DELETE = withErrorHandler('contracts/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid contract id' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.from('contracts').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete contract')
  }
  logAudit({ userName: 'system', action: 'deleted_contract', module: 'contracts', type: 'warning', metadata: { contractId: id } })
  return NextResponse.json({ deleted: id })
})
