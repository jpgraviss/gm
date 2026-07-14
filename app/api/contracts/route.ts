import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, CONTRACT_STATUSES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'

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

export const GET = withErrorHandler('contracts GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  // Portal clients (Approvals/Agreement/dashboard pages) legitimately call
  // this scoped to their own company — see matching comment in
  // app/api/proposals/route.ts.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('contracts')
    .select('*')
  if (company) query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch contracts')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapContract), nextCursor)
})

export const POST = withErrorHandler('contracts POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()

  const result = validate(body, {
    company:          { required: true, type: 'string', maxLength: 200 },
    status:           { type: 'string', enum: [...CONTRACT_STATUSES] },
    value:            { type: 'number', min: 0, max: 100_000_000 },
    duration:         { type: 'number', min: 1, max: 120 },
    serviceType:      { type: 'string', maxLength: 100 },
    assignedRep:      { type: 'string', maxLength: 200 },
    billingStructure: { type: 'string', enum: ['Monthly', 'Quarterly', 'Annual', 'One-time', 'Custom'] },
    startDate:        { type: 'string', maxLength: 30 },
    renewalDate:      { type: 'string', maxLength: 30 },
    proposalId:       { type: 'string', maxLength: 100 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('contracts')
    .insert({
      id:                `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      proposal_id:       body.proposalId ?? null,
      company_id:        body.companyId ?? null,
      company:           body.company,
      status:            body.status ?? 'Draft',
      value:             body.value ?? 0,
      billing_structure: body.billingStructure ?? 'Monthly',
      start_date:        body.startDate ?? null,
      duration:          body.duration ?? 12,
      renewal_date:      body.renewalDate ?? null,
      assigned_rep:      body.assignedRep ?? '',
      service_type:      body.serviceType ?? 'General',
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create contract')
  }
  return NextResponse.json(mapContract(data), { status: 201 })
})
