import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

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
  if (error) {
    console.error('[maintenance GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch maintenance records' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapRecord))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const result = validate(body, {
    company: { required: true, type: 'string', maxLength: 200 },
    monthlyFee: { type: 'number', min: 0 },
  })
  if (!result.valid) return validationError(result.error)
  const db = createServiceClient()
  const { data, error } = await db
    .from('maintenance_records')
    .insert({
      id:                  `maint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      company:             body.company,
      service_type:        body.serviceType ?? 'Website',
      start_date:          body.startDate ?? null,
      end_date:            body.endDate ?? null,
      monthly_fee:         body.monthlyFee ?? 0,
      contract_duration:   body.contractDuration ?? 12,
      cancellation_window: body.cancellationWindow ?? 30,
      cancellation_fee:    body.cancellationFee ?? null,
      payment_terms:       body.paymentTerms ?? null,
      status:              body.status ?? 'Active',
      next_billing_date:   body.nextBillingDate ?? null,
      documents:           body.documents ?? [],
    })
    .select()
    .single()
  if (error) {
    console.error('[maintenance POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create maintenance record' }, { status: 500 })
  }
  return NextResponse.json(mapRecord(data), { status: 201 })
}
