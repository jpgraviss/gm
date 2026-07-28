import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const ADDENDUM_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined'] as const
const CHANGE_TYPES = ['Scope Change', 'Value Change', 'Term Extension', 'Termination', 'Other'] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAddendum(row: any) {
  return {
    id:              row.id,
    contractId:      row.contract_id,
    title:           row.title,
    description:     row.description,
    status:          row.status,
    createdDate:     row.created_at?.split('T')[0] ?? '',
    sentDate:        row.sent_at?.split('T')[0] ?? undefined,
    changeType:      row.change_type ?? undefined,
    valueDelta:      row.value_delta != null ? Number(row.value_delta) : undefined,
    termDeltaMonths: row.term_delta_months ?? undefined,
    scopeAdded:      row.scope_added ?? undefined,
    scopeRemoved:    row.scope_removed ?? undefined,
    effectiveDate:   row.effective_date ?? undefined,
    deltaApplied:    row.delta_applied ?? false,
  }
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

export const GET = withErrorHandler('contracts/[id]/addendums GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('contract_addendums')
    .select('*')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json((data ?? []).map(mapAddendum))
})

export const POST = withErrorHandler('contracts/[id]/addendums POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id: contractId } = await params
  const body = await req.json()

  const result = validate(body, {
    title:           { required: true, type: 'string', maxLength: 300 },
    description:     { required: true, type: 'string', maxLength: 5000 },
    changeType:      { type: 'string', enum: [...CHANGE_TYPES] },
    valueDelta:      { type: 'number', min: -100_000_000, max: 100_000_000 },
    termDeltaMonths: { type: 'number', min: -120, max: 120 },
    scopeAdded:      { type: 'string', maxLength: 5000 },
    scopeRemoved:    { type: 'string', maxLength: 5000 },
    effectiveDate:   { type: 'string', maxLength: 30 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  // Verify the contract exists
  const { data: contract, error: cErr } = await db
    .from('contracts')
    .select('id')
    .eq('id', contractId)
    .single()
  if (cErr || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  }

  const { data, error } = await db
    .from('contract_addendums')
    .insert({
      id: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contract_id: contractId,
      title: body.title,
      description: body.description,
      status: 'Draft',
      change_type:       body.changeType ?? null,
      value_delta:       body.valueDelta ?? null,
      term_delta_months: body.termDeltaMonths ?? null,
      scope_added:       body.scopeAdded ?? null,
      scope_removed:     body.scopeRemoved ?? null,
      effective_date:    body.effectiveDate ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(mapAddendum(data), { status: 201 })
})

// AUDIT.md #466 — content fields (title/description/change fields) may only
// be edited while the addendum is still Draft: once it's been Sent, a client
// may already be looking at the version they were sent, so silently
// rewriting it out from under them would be worse than the original "typo
// sits there forever" problem this fix addresses.
const CONTENT_FIELDS = [
  'title', 'description', 'changeType', 'valueDelta',
  'termDeltaMonths', 'scopeAdded', 'scopeRemoved', 'effectiveDate',
] as const

export const PATCH = withErrorHandler('contracts/[id]/addendums PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)
  // This PATCH uses a query param ?addendumId=xxx to identify the addendum
  const { id: contractId } = await params
  const body = await req.json()
  const addendumId = body.addendumId

  if (!addendumId) {
    return NextResponse.json({ error: 'addendumId is required' }, { status: 400 })
  }

  const result = validate(body, {
    status:          { type: 'string', enum: [...ADDENDUM_STATUSES] },
    title:           { type: 'string', maxLength: 300 },
    description:     { type: 'string', maxLength: 5000 },
    changeType:      { type: 'string', enum: [...CHANGE_TYPES] },
    valueDelta:      { type: 'number', min: -100_000_000, max: 100_000_000 },
    termDeltaMonths: { type: 'number', min: -120, max: 120 },
    scopeAdded:      { type: 'string', maxLength: 5000 },
    scopeRemoved:    { type: 'string', maxLength: 5000 },
    effectiveDate:   { type: 'string', maxLength: 30 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const isContentEdit = CONTENT_FIELDS.some(f => body[f] !== undefined)

  if (isContentEdit) {
    const { data: existing, error: exErr } = await db
      .from('contract_addendums')
      .select('status')
      .eq('id', addendumId)
      .eq('contract_id', contractId)
      .single()
    if (exErr || !existing) {
      return NextResponse.json({ error: 'Addendum not found' }, { status: 404 })
    }
    if (existing.status !== 'Draft') {
      return NextResponse.json({ error: 'Only Draft addendums can be edited' }, { status: 400 })
    }
  }

  const update: Record<string, unknown> = {}
  if (body.status !== undefined) {
    update.status = body.status
    if (body.status === 'Sent') {
      update.sent_at = new Date().toISOString()
    }
  }
  if (body.title !== undefined) update.title = body.title
  if (body.description !== undefined) update.description = body.description
  if (body.changeType !== undefined) update.change_type = body.changeType
  if (body.valueDelta !== undefined) update.value_delta = body.valueDelta
  if (body.termDeltaMonths !== undefined) update.term_delta_months = body.termDeltaMonths
  if (body.scopeAdded !== undefined) update.scope_added = body.scopeAdded
  if (body.scopeRemoved !== undefined) update.scope_removed = body.scopeRemoved
  if (body.effectiveDate !== undefined) update.effective_date = body.effectiveDate

  const { data, error } = await db
    .from('contract_addendums')
    .update(update)
    .eq('id', addendumId)
    .eq('contract_id', contractId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const mapped = mapAddendum(data)

  // AUDIT.md #168 — accepting an addendum flipped its own status but never
  // pushed its value_delta/term_delta_months onto the parent contract, so
  // the contract's real value/duration/renewal_date (used everywhere else —
  // dashboards, MRR math, renewals) never reflected it. Apply on Accept via
  // the atomic RPC (supabase/migrations/add_addendum_delta_application.sql)
  // rather than a JS select-then-write here, so concurrent accepts and
  // multiple stacked addendums can't race or double-apply — the RPC claims
  // delta_applied on the addendum row itself as its compare-and-set guard.
  let updatedContract: ReturnType<typeof mapContract> | undefined
  if (body.status === 'Accepted' && (mapped.valueDelta != null || mapped.termDeltaMonths != null)) {
    const { data: applied, error: rpcError } = await db.rpc('apply_addendum_delta_to_contract', {
      p_addendum_id: addendumId,
      p_contract_id: contractId,
      p_value_delta: mapped.valueDelta ?? null,
      p_term_delta_months: mapped.termDeltaMonths ?? null,
    })
    if (rpcError) {
      throw new Error(rpcError.message)
    }
    if (applied) {
      mapped.deltaApplied = true
      const { data: contractRow } = await db.from('contracts').select('*').eq('id', contractId).single()
      if (contractRow) {
        updatedContract = mapContract(contractRow)
      }
      logAudit({
        userName: actor?.name || actor?.email || 'system',
        action: 'addendum_delta_applied',
        module: 'contracts',
        type: 'action',
        metadata: {
          contractId,
          addendumId,
          valueDelta: mapped.valueDelta ?? null,
          termDeltaMonths: mapped.termDeltaMonths ?? null,
          newContractValue: updatedContract?.value ?? null,
          newContractDuration: updatedContract?.duration ?? null,
          newRenewalDate: updatedContract?.renewalDate ?? null,
        },
      })
    }
  }

  return NextResponse.json(updatedContract ? { ...mapped, contract: updatedContract } : mapped)
})

// AUDIT.md #466 — deletion (like content edits above) is restricted to
// Draft-status addendums: identified via a ?addendumId= query param, matching
// this file's existing convention of scoping every write to `contract_id`
// as well so an id can't be targeted against the wrong contract.
export const DELETE = withErrorHandler('contracts/[id]/addendums DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id: contractId } = await params
  const addendumId = req.nextUrl.searchParams.get('addendumId')

  if (!addendumId) {
    return NextResponse.json({ error: 'addendumId is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: existing, error: exErr } = await db
    .from('contract_addendums')
    .select('status')
    .eq('id', addendumId)
    .eq('contract_id', contractId)
    .single()
  if (exErr || !existing) {
    return NextResponse.json({ error: 'Addendum not found' }, { status: 404 })
  }
  if (existing.status !== 'Draft') {
    return NextResponse.json({ error: 'Only Draft addendums can be deleted' }, { status: 400 })
  }

  const { error } = await db
    .from('contract_addendums')
    .delete()
    .eq('id', addendumId)
    .eq('contract_id', contractId)

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ success: true })
})
