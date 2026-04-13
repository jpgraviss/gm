import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBinding(row: any) {
  return {
    id:                   row.id,
    companyId:            row.company_id ?? undefined,
    companyName:          row.company_name,
    gscSiteUrl:           row.gsc_site_url ?? undefined,
    ga4PropertyId:        row.ga4_property_id ?? undefined,
    ga4PropertyLabel:     row.ga4_property_label ?? undefined,
    adsCustomerId:        row.ads_customer_id ?? undefined,
    adsCustomerLabel:     row.ads_customer_label ?? undefined,
    metaAdAccountId:      row.meta_ad_account_id ?? undefined,
    metaAdAccountLabel:   row.meta_ad_account_label ?? undefined,
    gbpLocationName:      row.gbp_location_name ?? undefined,
    gbpLocationLabel:     row.gbp_location_label ?? undefined,
    portalEnabled:        row.portal_enabled,
    portalWidgets:        row.portal_widgets ?? [],
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const db = createServiceClient()

  let query = db.from('client_integrations').select('*')
  if (company) query = query.eq('company_name', company)

  const { data, error } = await query.order('company_name')
  if (error) {
    console.error('[client-integrations GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapBinding))
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const body = await req.json()
  if (!body.companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const id = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const row = {
    id,
    company_id:            body.companyId ?? null,
    company_name:          body.companyName,
    gsc_site_url:          body.gscSiteUrl ?? null,
    ga4_property_id:       body.ga4PropertyId ?? null,
    ga4_property_label:    body.ga4PropertyLabel ?? null,
    ads_customer_id:       body.adsCustomerId ?? null,
    ads_customer_label:    body.adsCustomerLabel ?? null,
    meta_ad_account_id:    body.metaAdAccountId ?? null,
    meta_ad_account_label: body.metaAdAccountLabel ?? null,
    gbp_location_name:     body.gbpLocationName ?? null,
    gbp_location_label:    body.gbpLocationLabel ?? null,
    portal_enabled:        body.portalEnabled ?? false,
    portal_widgets:        body.portalWidgets ?? ['seo', 'traffic', 'ads', 'reputation', 'uptime', 'rankings'],
  }

  const { data, error } = await db
    .from('client_integrations')
    .upsert(row, { onConflict: 'workspace_id,company_name' })
    .select()
    .single()

  if (error) {
    console.error('[client-integrations POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'client_integration_bound', module: 'integrations', type: 'action', metadata: { companyName: body.companyName } })
  return NextResponse.json(mapBinding(data), { status: 201 })
}
