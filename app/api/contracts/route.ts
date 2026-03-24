import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapContract(row: any) {
  return {
    id:               row.id,
    proposalId:       row.proposal_id ?? undefined,
    company:          row.company,
    status:           row.status,
    value:            row.value,
    billingStructure: row.billing_structure,
    startDate:        row.start_date ?? '',
    duration:         row.duration,
    renewalDate:      row.renewal_date ?? '',
    assignedRep:      row.assigned_rep,
    serviceType:      row.service_type,
    clientSigned:     row.client_signed ?? undefined,
    internalSigned:   row.internal_signed ?? undefined,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const db = createServiceClient()
  let query = db.from('contracts').select('*').order('created_at', { ascending: false })
  if (company) query = query.eq('company', company)
  const { data, error } = await query
  if (error) {
    console.error('[contracts GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch contracts' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapContract))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const { data, error } = await db
    .from('contracts')
    .insert({
      id:                `c-${Date.now()}`,
      proposal_id:       body.proposalId ?? null,
      company:           body.company,
      status:            body.status ?? 'Draft',
      value:             body.value ?? 0,
      billing_structure: body.billingStructure ?? 'Monthly',
      start_date:        body.startDate ?? null,
      duration:          body.duration ?? 12,
      renewal_date:      body.renewalDate ?? null,
      assigned_rep:      body.assignedRep ?? '',
      service_type:      body.serviceType ?? 'General',
    })
    .select()
    .single()
  if (error) {
    console.error('[contracts POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create contract' }, { status: 500 })
  }
  return NextResponse.json(mapContract(data), { status: 201 })
}
