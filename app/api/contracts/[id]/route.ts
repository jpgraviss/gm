import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { fireAutomations } from '@/lib/automations-engine'
import { validate, validationError, CONTRACT_STATUSES } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient, isStaffCaller } from '@/lib/portal-auth'

// Fields the real portal Approvals UI ever sends (app/portal/approvals/page.tsx:
// { status: 'Signed by Client', clientSigned }, { status: 'Expired' },
// { status: 'Draft' }). Everything else — including company/companyId,
// added this session — is staff-only: requirePortalClient only checks the
// record's CURRENT company, not what a portal client is trying to change
// it TO, so an unrestricted field set would let a portal client reassign
// their own contract to an arbitrary different company.
const PORTAL_CLIENT_EDITABLE_FIELDS = new Set(['status', 'clientSigned'])

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
    company:          { type: 'string', maxLength: 200 },
    companyId:        { type: 'string', maxLength: 100 },
    serviceType:      { type: 'string', maxLength: 100 },
    startDate:        { type: 'string', maxLength: 30 },
    duration:         { type: 'number', min: 1, max: 120 },
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

  // requirePortalClient only confirms the caller may touch a contract
  // CURRENTLY belonging to their company — it says nothing about which
  // fields they may set it TO. Without this, a portal client could set
  // company/companyId to a different company's, silently reassigning
  // their own contract (with fully attacker-controlled value/billing/
  // dates) into another client's portal view.
  if (!(await isStaffCaller(req))) {
    const disallowed = Object.keys(body).filter(k => !PORTAL_CLIENT_EDITABLE_FIELDS.has(k))
    if (disallowed.length > 0) {
      return NextResponse.json({ error: `Not permitted to update: ${disallowed.join(', ')}` }, { status: 403 })
    }
  }

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
  // Renaming a contract's company is a legitimate correction (e.g. wrong
  // company selected at creation), but app/crm/pipeline/page.tsx and
  // app/renewals/page.tsx still link deals/renewals to a contract by
  // matching this NAME string, not companyId — a rename here won't
  // retroactively update those existing string matches. Not fixed here
  // (out of scope for "let me edit a contract"); flagged in AUDIT.md.
  if (body.company !== undefined)           update.company = body.company
  if (body.serviceType !== undefined)       update.service_type = body.serviceType
  if (body.startDate !== undefined)         update.start_date = body.startDate
  if (body.duration !== undefined)          update.duration = body.duration

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
