import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

const SETTINGS_ID = 'global'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle()
  if (error) {
    console.error('[settings GET]', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
  return NextResponse.json(data ?? {})
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
  if (body.gcalLinks        !== undefined) updates.gcal_links       = body.gcalLinks
  if (body.pipelines        !== undefined) updates.pipelines        = body.pipelines

  const { data, error } = await db
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, ...updates }, { onConflict: 'id' })
    .select()
    .single()
  if (error) {
    console.error('[settings PATCH]', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
  logAudit({ userName: 'admin', action: 'updated_settings', module: 'settings', type: 'action' })
  return NextResponse.json(data)
}
