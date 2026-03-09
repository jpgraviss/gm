import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, isConfigured } from '@/lib/supabase'
import { crmCompanies as seedCompanies } from '@/lib/data'

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(seedCompanies)
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_companies')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!isConfigured) {
    return NextResponse.json({ ...body, id: `co-${Date.now()}` })
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_companies')
    .insert({
      id:               `co-${Date.now()}`,
      name:             body.name,
      industry:         body.industry,
      website:          body.website,
      phone:            body.phone,
      hq:               body.hq,
      size:             body.size,
      annual_revenue:   body.annualRevenue,
      status:           body.status ?? 'Prospect',
      owner:            body.owner,
      description:      body.description,
      tags:             body.tags ?? [],
      contact_ids:      body.contactIds ?? [],
      deal_ids:         body.dealIds ?? [],
      total_deal_value: body.totalDealValue ?? 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
