import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(row: any) {
  return {
    id:                 row.id,
    company:            row.company,
    serviceType:        row.service_type,
    startDate:          row.start_date ?? '',
    endDate:            row.end_date ?? undefined,
    monthlyFee:         row.monthly_fee,
    contractDuration:   row.contract_duration,
    cancellationWindow: row.cancellation_window,
    cancellationFee:    row.cancellation_fee ?? undefined,
    paymentTerms:       row.payment_terms ?? undefined,
    status:             row.status,
    nextBillingDate:    row.next_billing_date ?? '',
    documents:          row.documents ?? [],
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const db = createServiceClient()
  let query = db.from('maintenance_records').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(mapRecord))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()

  // Try full insert (with new columns). If it fails due to missing columns (migration not yet run),
  // fall back to the base insert without the new fields so the record still saves.
  const baseInsert = {
    id:                  `maint-${Date.now()}`,
    company:             body.company,
    service_type:        body.serviceType ?? 'Website',
    start_date:          body.startDate ?? null,
    monthly_fee:         body.monthlyFee ?? 0,
    contract_duration:   body.contractDuration ?? 12,
    cancellation_window: body.cancellationWindow ?? 30,
    status:              body.status ?? 'Active',
    next_billing_date:   body.nextBillingDate ?? null,
    documents:           body.documents ?? [],
  }

  const fullInsert = {
    ...baseInsert,
    end_date:          body.endDate ?? null,
    cancellation_fee:  body.cancellationFee ?? null,
    payment_terms:     body.paymentTerms ?? null,
  }

  let result = await db.from('maintenance_records').insert(fullInsert).select().single()

  // If full insert failed (likely missing columns), retry with base fields only
  if (result.error) {
    result = await db.from('maintenance_records').insert(baseInsert).select().single()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json(mapRecord(result.data), { status: 201 })
}
