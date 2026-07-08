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
  const seoStrategy = (config.seoStrategy as Record<string, unknown>)
    ?? (config.seo_strategy as Record<string, unknown>)
    ?? null

  const showSeo = visibility?.showSeoStrategy === true || config.show_seo === true

  return NextResponse.json({
    strategy: seoStrategy,
    showSeo,
  })
})
