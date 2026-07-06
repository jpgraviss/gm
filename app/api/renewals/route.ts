import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRenewal(row: any) {
  const daysUntilExpiry = row.expiration_date
    ? Math.ceil((new Date(row.expiration_date).getTime() - Date.now()) / 86400000)
    : row.days_until_expiry ?? 0
  return {
    id:              row.id,
    company:         row.company,
    companyId:       row.company_id || null,
    contractId:      row.contract_id ?? '',
    expirationDate:  row.expiration_date ?? '',
    renewalValue:    row.renewal_value,
    assignedRep:     row.assigned_rep,
    status:          row.status,
    daysUntilExpiry,
    serviceType:     row.service_type,
    proposalData:    row.proposal_data ?? null,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('renewals')
    .select('*')
  if (status) query = query.eq('status', status)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    console.error('[renewals GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch renewals' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapRenewal), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    renewalValue: { type: 'number', min: 0 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const { data, error } = await db
    .from('renewals')
    .insert({
      id:               `ren-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      company:          body.company,
      company_id:       body.companyId || null,
      contract_id:      body.contractId ?? null,
      expiration_date:  body.expirationDate ?? null,
      renewal_value:    body.renewalValue ?? 0,
      assigned_rep:     body.assignedRep ?? '',
      status:           body.status ?? 'Upcoming',
      days_until_expiry: body.daysUntilExpiry ?? 0,
      service_type:     body.serviceType ?? 'General',
    })
    .select()
    .single()
  if (error) {
    console.error('[renewals POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create renewal' }, { status: 500 })
  }
  return NextResponse.json(mapRenewal(data), { status: 201 })
}
