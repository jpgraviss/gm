import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { buildClientReport } from '@/lib/client-reports'
import { requirePortalClient } from '@/lib/portal-auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const companyName = searchParams.get('company')
  const days = parseInt(searchParams.get('days') ?? '28', 10)

  if (!companyName) {
    return NextResponse.json({ error: 'company param is required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, companyName)
  if (denied) return denied

  const db = createServiceClient()
  const { data: binding } = await db
    .from('client_integrations')
    .select('*')
    .eq('company_name', companyName)
    .maybeSingle()

  if (!binding) {
    return NextResponse.json({ error: 'No integrations configured for this client' }, { status: 404 })
  }

  if (!binding.portal_enabled) {
    return NextResponse.json({ error: 'Portal insights are disabled for this client' }, { status: 403 })
  }

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  try {
    const report = await buildClientReport({
      companyName,
      companyId:       binding.company_id ?? undefined,
      gscSiteUrl:      binding.gsc_site_url ?? undefined,
      ga4PropertyId:   binding.ga4_property_id ?? undefined,
      gbpLocationName: binding.gbp_location_name ?? undefined,
      startDate: fmt(start),
      endDate:   fmt(end),
    })

    const allowed = new Set<string>(binding.portal_widgets ?? [])
    const filtered: Record<string, unknown> = {
      company: report.company,
      period:  report.period,
    }
    if (allowed.has('seo')        && report.seo)         filtered.seo = report.seo
    if (allowed.has('traffic')    && report.traffic)     filtered.traffic = report.traffic
    if (allowed.has('reputation') && report.reputation)  filtered.reputation = report.reputation
    if (allowed.has('rankings')   && report.ranking)     filtered.ranking = report.ranking
    if (allowed.has('uptime')     && report.uptime)      filtered.uptime = report.uptime

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('[portal/insights]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load insights' },
      { status: 500 },
    )
  }
}
