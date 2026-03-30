import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, PROPOSAL_STATUSES } from '@/lib/validation'

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

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[proposals GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch proposals' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapProposal))
}

export async function POST(req: NextRequest) {
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
    console.error('[proposals POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create proposal' }, { status: 500 })
  }
  return NextResponse.json(mapProposal(data), { status: 201 })
}
