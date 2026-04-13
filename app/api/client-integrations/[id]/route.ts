import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBinding(row: any) {
  return {
    id:                 row.id,
    companyId:          row.company_id ?? undefined,
    companyName:        row.company_name,
    gscSiteUrl:         row.gsc_site_url ?? undefined,
    ga4PropertyId:      row.ga4_property_id ?? undefined,
    ga4PropertyLabel:   row.ga4_property_label ?? undefined,
    adsCustomerId:      row.ads_customer_id ?? undefined,
    adsCustomerLabel:   row.ads_customer_label ?? undefined,
    metaAdAccountId:    row.meta_ad_account_id ?? undefined,
    metaAdAccountLabel: row.meta_ad_account_label ?? undefined,
    gbpLocationName:    row.gbp_location_name ?? undefined,
    gbpLocationLabel:   row.gbp_location_label ?? undefined,
    portalEnabled:      row.portal_enabled,
    portalWidgets:      row.portal_widgets ?? [],
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data } = await db.from('client_integrations').select('*').eq('id', id).single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(mapBinding(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.gscSiteUrl !== undefined)          update.gsc_site_url = body.gscSiteUrl
  if (body.ga4PropertyId !== undefined)       update.ga4_property_id = body.ga4PropertyId
  if (body.ga4PropertyLabel !== undefined)    update.ga4_property_label = body.ga4PropertyLabel
  if (body.adsCustomerId !== undefined)       update.ads_customer_id = body.adsCustomerId
  if (body.adsCustomerLabel !== undefined)    update.ads_customer_label = body.adsCustomerLabel
  if (body.metaAdAccountId !== undefined)     update.meta_ad_account_id = body.metaAdAccountId
  if (body.metaAdAccountLabel !== undefined)  update.meta_ad_account_label = body.metaAdAccountLabel
  if (body.gbpLocationName !== undefined)     update.gbp_location_name = body.gbpLocationName
  if (body.gbpLocationLabel !== undefined)    update.gbp_location_label = body.gbpLocationLabel
  if (body.portalEnabled !== undefined)       update.portal_enabled = body.portalEnabled
  if (body.portalWidgets !== undefined)       update.portal_widgets = body.portalWidgets

  const { data, error } = await db
    .from('client_integrations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[client-integrations PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json(mapBinding(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('client_integrations').delete().eq('id', id)
  if (error) {
    console.error('[client-integrations DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'client_integration_deleted', module: 'integrations', type: 'warning', metadata: { id } })
  return NextResponse.json({ deleted: id })
}
