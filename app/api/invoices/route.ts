import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'

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

// Read-only — invoice data comes from QuickBooks sync
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contractId = searchParams.get('contractId')
  const status     = searchParams.get('status')
  const company    = searchParams.get('company')
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()
  let query = db
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (contractId) query = query.eq('contract_id', contractId)
  if (status)     query = query.eq('status', status)
  if (company)    query = query.eq('company', company)
  if (cursor) query = query.lt('created_at', cursor)
  const { data, error } = await query
  if (error) {
    console.error('[invoices GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch invoices' }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapInvoice), nextCursor)
}
