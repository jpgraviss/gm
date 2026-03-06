import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'
import { contracts as seedContracts } from '@/lib/data'

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(seedContracts)
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ ...body, id: `c-${Date.now()}` })
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('contracts')
    .insert({
      id:                `c-${Date.now()}`,
      proposal_id:       body.proposalId,
      company:           body.company,
      status:            body.status ?? 'Draft',
      value:             body.value ?? 0,
      billing_structure: body.billingStructure,
      start_date:        body.startDate,
      duration:          body.duration ?? 12,
      renewal_date:      body.renewalDate,
      assigned_rep:      body.assignedRep,
      service_type:      body.serviceType,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
