import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(row: any) {
  return {
    id:          row.id,
    contractId:  row.contract_id ?? '',
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
  const db = createServiceClient()
  let query = db.from('invoices').select('*').order('created_at', { ascending: false })
  if (contractId) query = query.eq('contract_id', contractId)
  if (status)     query = query.eq('status', status)
  if (company)    query = query.eq('company', company)
  const { data, error } = await query
  if (error) {
    console.error('[invoices GET]', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapInvoice))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('invoices')
    .insert({
      id:          `inv-${Date.now()}`,
      contract_id: body.contractId ?? null,
      company:     body.company,
      amount:      body.amount ?? 0,
      status:      body.status ?? 'Pending',
      due_date:    body.dueDate ?? null,
      issued_date: body.issuedDate ?? new Date().toISOString().split('T')[0],
      service_type: body.serviceType ?? 'General',
    })
    .select()
    .single()
  if (error) {
    console.error('[invoices POST]', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
  return NextResponse.json(mapInvoice(data), { status: 201 })
}
