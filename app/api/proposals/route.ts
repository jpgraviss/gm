import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROPOSAL_STATUSES } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient } from '@/lib/portal-auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProposal(row: any) {
  return {
    id:                         row.id,
    dealId:                     row.deal_id ?? '',
    companyId:                  row.company_id || null,
    company:                    row.company,
    status:                     row.status,
    value:                      row.value,
    serviceType:                row.service_type,
    assignedRep:                row.assigned_rep,
    items:                      row.items ?? [],
    isRenewal:                  row.is_renewal ?? false,
    internalOnly:               row.internal_only ?? false,
    renewalNotes:               row.renewal_notes ?? undefined,
    pdfPath:                    row.pdf_path ?? undefined,
    formSubmissionId:           row.form_submission_id ?? undefined,
    generationNotes:            row.generation_notes ?? undefined,
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

export const GET = withErrorHandler('proposals GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  // Portal clients (the real Approvals/Agreement pages) legitimately call
  // this scoped to their own company — requirePortalClient lets staff
  // through unconditionally and restricts portal clients to their own
  // company. Omitting company is a full cross-company listing, staff-only.
  const denied = company
    ? await requirePortalClient(req, company)
    : await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('proposals')
    .select('*')
  if (company) query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch proposals')
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapProposal), nextCursor)
})

export const POST = withErrorHandler('proposals POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()

  const result = validate(body, {
    company:     { required: true, type: 'string', maxLength: 200 },
    status:      { type: 'string', enum: [...PROPOSAL_STATUSES] },
    value:       { type: 'number', min: 0, max: 100_000_000 },
    serviceType: { type: 'string', maxLength: 100 },
    assignedRep: { type: 'string', maxLength: 200 },
    items:       { type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .insert({
      id:            body.id ?? `p-${Date.now()}`,
      deal_id:       body.dealId ?? null,
      company_id:    body.companyId ?? null,
      company:       body.company,
      status:        body.status ?? 'Draft',
      value:         body.value ?? 0,
      service_type:  body.serviceType ?? 'General',
      assigned_rep:  body.assignedRep ?? '',
      items:         body.items ?? [],
      is_renewal:    body.isRenewal ?? false,
      internal_only: body.internalOnly ?? false,
      created_date:  new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to create proposal')
  }
  return NextResponse.json(mapProposal(data), { status: 201 })
})
