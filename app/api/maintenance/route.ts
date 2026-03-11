import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(row: any) {
  return {
    id:                 row.id,
    company:            row.company,
    serviceType:        row.service_type,
    startDate:          row.start_date ?? '',
    monthlyFee:         row.monthly_fee,
    contractDuration:   row.contract_duration,
    cancellationWindow: row.cancellation_window,
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
  const { data, error } = await db
    .from('maintenance_records')
    .insert({
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
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapRecord(data), { status: 201 })
}
