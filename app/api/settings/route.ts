import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const SETTINGS_ID = 'global'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettings(row: any) {
  return {
    id:              row.id,
    company:         row.company ?? {},
    notifications:   row.notifications ?? [],
    qbSync:          row.qb_sync ?? [],
    invoiceDefaults: row.invoice_defaults ?? {},
    pipelineStages:  row.pipeline_stages ?? [],
    serviceTypes:    row.service_types ?? [],
    contactTags:     row.contact_tags ?? [],
    branding:        row.branding ?? {},
    updatedAt:       row.updated_at,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json(null)
  return NextResponse.json(mapSettings(data))
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.company          !== undefined) updates.company          = body.company
  if (body.notifications    !== undefined) updates.notifications    = body.notifications
  if (body.invoiceDefaults  !== undefined) updates.invoice_defaults = body.invoiceDefaults
  if (body.pipelineStages   !== undefined) updates.pipeline_stages  = body.pipelineStages
  if (body.serviceTypes     !== undefined) updates.service_types    = body.serviceTypes
  if (body.contactTags      !== undefined) updates.contact_tags     = body.contactTags
  if (body.branding         !== undefined) updates.branding         = body.branding
  if (body.qbSync           !== undefined) updates.qb_sync          = body.qbSync

  const { data, error } = await db
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, ...updates }, { onConflict: 'id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapSettings(data))
}

export async function POST(req: NextRequest) {
  return PATCH(req)
}
