import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { requireRole } from '@/lib/rbac'

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

export const PATCH = withErrorHandler('contracts/[id]/addendums PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  // This PATCH uses a query param ?addendumId=xxx to identify the addendum
  const { id: contractId } = await params
  const body = await req.json()
  const addendumId = body.addendumId

  if (!addendumId) {
    return NextResponse.json({ error: 'addendumId is required' }, { status: 400 })
  }

  const result = validate(body, {
    status: { type: 'string', enum: [...ADDENDUM_STATUSES] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()

  const update: Record<string, unknown> = {}
  if (body.status !== undefined) {
    update.status = body.status
    if (body.status === 'Sent') {
      update.sent_at = new Date().toISOString()
    }
  }

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

  return NextResponse.json(mapAddendum(data))
})
