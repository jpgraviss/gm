import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requirePortalClient } from '@/lib/portal-auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('portal/seo GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  if (!company) {
    return NextResponse.json({ error: 'company param is required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  const db = createServiceClient()
  const { data: portalClient } = await db
    .from('portal_clients')
    .select('portal_config, services')
    .eq('company', company)
    .maybeSingle()

  if (!portalClient) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const config = (portalClient.portal_config as Record<string, unknown>) ?? {}
  const visibility = config.visibility as Record<string, unknown> | undefined
  const rawStrategy = config.seoStrategy ?? config.seo_strategy ?? null

  // AUDIT #232 — the admin "SEO Strategy (Legacy)" textarea
  // (app/admin/portal-management/page.tsx) stores this as a plain string,
  // but the consumer (app/portal/services/seo/page.tsx) does
  // {...DEFAULT_STRATEGY, ...strategy} expecting a rich object — spreading a
  // raw string copies its characters as numeric-indexed props matching none
  // of the real fields, so an admin's real strategy text never appeared,
  // only the hardcoded placeholder did. Wrap the string into the shape the
  // reader expects instead of passing it straight through.
  let seoStrategy: Record<string, unknown> | null = null
  if (typeof rawStrategy === 'string') {
    seoStrategy = rawStrategy.trim() ? { overview: rawStrategy } : null
  } else if (rawStrategy && typeof rawStrategy === 'object') {
    seoStrategy = rawStrategy as Record<string, unknown>
  }

  const showSeo = visibility?.showSeoStrategy === true || config.show_seo === true

  // AUDIT #672 — the page rendering this (app/client/seo/page.tsx) shows
  // Keyword Rankings, 4 KPI cards, and a Monthly Deliverables checklist,
  // but nothing ever wrote most of those fields — every client saw an
  // empty page. organicTraffic/domainAuthority/backlinks/deliverables
  // have no internal data source, so they're now admin-editable
  // (portal_config.seoMetrics, app/admin/portal-management/page.tsx).
  // keywords/keywordsRanking are NOT hand-entered — they compute live
  // from the real tracked_keywords table below, the same GSC-backed data
  // staff already see, only visible to the client if explicitly marked
  // portal_visible (same rule GET /api/tracked-keywords enforces).
  const seoMetrics = (config.seoMetrics as Record<string, unknown> | undefined) ?? {}
  const { data: trackedKeywords } = await db
    .from('tracked_keywords')
    .select('keyword, current_position, previous_position')
    .eq('company_name', company)
    .eq('portal_visible', true)
    .order('current_position', { ascending: true, nullsFirst: false })
    .limit(20)
  const keywords = (trackedKeywords ?? []).map(k => ({
    keyword: k.keyword,
    currentRank: k.current_position ?? 0,
    previousRank: k.previous_position ?? k.current_position ?? 0,
  }))

  const mergedStrategy = {
    ...(seoStrategy ?? {}),
    organicTraffic: typeof seoMetrics.organicTraffic === 'number' ? seoMetrics.organicTraffic : 0,
    domainAuthority: typeof seoMetrics.domainAuthority === 'number' ? seoMetrics.domainAuthority : 0,
    backlinks: typeof seoMetrics.backlinks === 'number' ? seoMetrics.backlinks : 0,
    deliverables: Array.isArray(seoMetrics.deliverables) ? seoMetrics.deliverables : [],
    keywords,
    keywordsRanking: keywords.length,
  }

  return NextResponse.json({
    strategy: mergedStrategy,
    showSeo,
  })
})
