import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'
import { proposals as seedProposals } from '@/lib/data'

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(seedProposals)
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ ...body, id: `p-${Date.now()}`, createdDate: new Date().toISOString().split('T')[0] })
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('proposals')
    .insert({
      id:           body.id ?? `p-${Date.now()}`,
      deal_id:      body.dealId,
      company:      body.company,
      status:       body.status ?? 'Draft',
      value:        body.value ?? 0,
      service_type: body.serviceType,
      assigned_rep: body.assignedRep,
      items:        body.items ?? [],
      is_renewal:   body.isRenewal ?? false,
      internal_only: body.internalOnly ?? false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
