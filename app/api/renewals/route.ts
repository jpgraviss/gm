import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRenewal(row: any) {
  return {
    id:              row.id,
    company:         row.company,
    contractId:      row.contract_id ?? '',
    expirationDate:  row.expiration_date ?? '',
    renewalValue:    row.renewal_value,
    assignedRep:     row.assigned_rep,
    status:          row.status,
    daysUntilExpiry: row.days_until_expiry,
    serviceType:     row.service_type,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const db = createServiceClient()
  let query = db.from('renewals').select('*').order('expiration_date', { ascending: true })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) {
    console.error('[renewals GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch renewals' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapRenewal))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('renewals')
    .insert({
      id:               `ren-${Date.now()}`,
      company:          body.company,
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
