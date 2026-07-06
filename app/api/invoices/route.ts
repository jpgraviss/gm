import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { validate, validationError, INVOICE_STATUSES } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(row: any) {
  return {
    id:          row.id,
    contractId:  row.contract_id ?? '',
    companyId:   row.company_id || null,
    company:     row.company,
    amount:      row.amount,
    status:      row.status,
    dueDate:     row.due_date ?? '',
    issuedDate:  row.issued_date ?? '',
    paidDate:    row.paid_date ?? undefined,
    serviceType: row.service_type,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contractId = searchParams.get('contractId')
  const status     = searchParams.get('status')
  const company    = searchParams.get('company')
  const pag = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('invoices')
    .select('*')
  if (contractId) query = query.eq('contract_id', contractId)
  if (status)     query = query.eq('status', status)
  if (company)    query = query.eq('company', company)
  query = applyCursor(query, pag)
  const { data, error } = await query
  if (error) {
    console.error('[invoices GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch invoices' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapInvoice), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = validate(body, {
    company:     { required: true, type: 'string', maxLength: 200 },
    amount:      { required: true, type: 'number', min: 0 },
    status:      { type: 'string', enum: [...INVOICE_STATUSES] },
    dueDate:     { type: 'string', maxLength: 30 },
    serviceType: { type: 'string', maxLength: 100 },
    contractId:  { type: 'string', maxLength: 100 },
  })
  if (!result.valid) return validationError(result.error)

  const today = new Date().toISOString().split('T')[0]
  const db = createServiceClient()
  const { data, error } = await db
    .from('invoices')
    .insert({
      id:           `inv-${Date.now()}`,
      company_id:   body.companyId ?? null,
      company:      body.company,
      amount:       body.amount,
      status:       body.status ?? 'Pending',
      due_date:     body.dueDate ?? null,
      issued_date:  today,
      service_type: body.serviceType ?? 'General',
      contract_id:  body.contractId ?? null,
      source:       'manual',
    })
    .select()
    .single()

  if (error) {
    console.error('[invoices POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create invoice' }, { status: 500 })
  }

  return NextResponse.json(mapInvoice(data), { status: 201 })
}
