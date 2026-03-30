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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    .update({
      name:             body.name,
      industry:         body.industry,
      website:          body.website ?? null,
      phone:            body.phone ?? null,
      hq:               body.hq,
      size:             body.size,
      annual_revenue:   body.annualRevenue ?? null,
      status:           body.status,
      owner:            body.owner,
      description:      body.description ?? null,
      tags:             body.tags ?? [],
      contact_ids:      body.contactIds ?? [],
      deal_ids:         body.dealIds ?? [],
      total_deal_value: body.totalDealValue ?? 0,
      last_activity:    body.lastActivity ?? null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[crm/companies/:id PUT]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update company' }, { status: 500 })
  }
  return NextResponse.json(mapCompany(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    status: { type: 'string', enum: ['Prospect', 'Active Client', 'Past Client', 'Partner', 'Churned'] },
    tags:   { type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const updates: Record<string, unknown> = {}
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.status !== undefined) updates.status = body.status
  if (body.lastActivity !== undefined) updates.last_activity = body.lastActivity
  const { data, error } = await db
    .from('crm_companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[crm/companies/:id PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update company' }, { status: 500 })
  }
  return NextResponse.json(mapCompany(data))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('crm_companies').delete().eq('id', id)
  if (error) {
    console.error('[crm/companies/:id DELETE]', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete company' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
