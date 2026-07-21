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

  return NextResponse.json({
    strategy: seoStrategy,
    showSeo,
  })
})
