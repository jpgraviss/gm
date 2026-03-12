import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const SETTINGS_ID = 'gravhub-settings'

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
    updatedAt:       row.updated_at,
  }
}

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single()
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json(null)
  return NextResponse.json(mapSettings(data))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = createServiceClient()
  const payload = {
    id:               SETTINGS_ID,
    company:          body.company ?? {},
    notifications:    body.notifications ?? [],
    qb_sync:          body.qbSync ?? [],
    invoice_defaults: body.invoiceDefaults ?? {},
    pipeline_stages:  body.pipelineStages ?? [],
    service_types:    body.serviceTypes ?? [],
    contact_tags:     body.contactTags ?? [],
    updated_at:       new Date().toISOString(),
  }
  const { data, error } = await db
    .from('app_settings')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(mapSettings(data))
}

export async function PATCH(req: NextRequest) {
  return POST(req)
}
