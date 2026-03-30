import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompany(row: any) {
  return {
    id:             row.id,
    name:           row.name,
    industry:       row.industry,
    website:        row.website ?? undefined,
    phone:          row.phone ?? undefined,
    hq:             row.hq,
    size:           row.size,
    annualRevenue:  row.annual_revenue ?? undefined,
    status:         row.status,
    owner:          row.owner,
    description:    row.description ?? undefined,
    tags:           row.tags ?? [],
    contactIds:     row.contact_ids ?? [],
    dealIds:        row.deal_ids ?? [],
    totalDealValue: row.total_deal_value ?? 0,
    createdDate:    row.created_date ?? '',
    lastActivity:   row.last_activity ?? undefined,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_companies')
    .select('*')
    .order('name')
  if (error) {
    console.error('[crm/companies GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to fetch companies' }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapCompany))
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const result = validate(body, {
    name:     { required: true, type: 'string', maxLength: 200 },
    industry: { type: 'string', maxLength: 100 },
    website:  { type: 'string', maxLength: 500 },
    phone:    { type: 'string', maxLength: 50 },
    size:     { type: 'string', enum: ['1-10', '11-50', '51-200', '201-500', '500+'] },
    status:   { type: 'string', enum: ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned'] },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('crm_companies')
    .insert({
      id:               `co-${Date.now()}`,
      name:             body.name,
      industry:         body.industry,
      website:          body.website ?? null,
      phone:            body.phone ?? null,
      hq:               body.hq,
      size:             body.size,
      annual_revenue:   body.annualRevenue ?? null,
      status:           body.status ?? 'Prospect',
      owner:            body.owner,
      description:      body.description ?? null,
      tags:             body.tags ?? [],
      contact_ids:      body.contactIds ?? [],
      deal_ids:         body.dealIds ?? [],
      total_deal_value: body.totalDealValue ?? 0,
      created_date:     new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (error) {
    console.error('[crm/companies POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to create company' }, { status: 500 })
  }
  return NextResponse.json(mapCompany(data), { status: 201 })
}
