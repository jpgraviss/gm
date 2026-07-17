import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { getGA4Report, getGA4TrafficSources, getGA4TopPages } from '@/lib/google-analytics'
import { getGSCSummary } from '@/lib/google-search-console'

const DAYS = 28

/**
 * Traffic analytics for the WordPress plugin's dashboard — GET only, the
 * plugin has nothing to write here. A WordPress site only knows its own
 * site_url; it has to be resolved to a GravHub company (via
 * wordpress_site_health, the same staff-curated link `health/route.ts`
 * already establishes) before we know which GA4 property / GSC site to
 * query. Every stage that can come up empty (unlinked site, no
 * client_integrations row, GA4/GSC not configured on that integration, a
 * live Google API failure) returns an honest partial/empty payload instead
 * of an error or a fabricated number — the plugin renders a "not connected
 * yet" state for whatever's missing.
 */
export const GET = withErrorHandler('wordpress/seo/analytics GET', async (req) => {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const siteUrl = req.nextUrl.searchParams.get('site')
  if (!siteUrl) {
    return NextResponse.json({ error: 'site query param is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: health } = await db
    .from('wordpress_site_health')
    .select('company_id')
    .eq('site_url', siteUrl)
    .maybeSingle()

  if (!health?.company_id) {
    return NextResponse.json({ connected: false, configured: false })
  }

  const { data: integration } = await db
    .from('client_integrations')
    .select('gsc_site_url, ga4_property_id')
    .eq('company_id', health.company_id)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ connected: true, configured: false })
  }

  const result: {
    connected: true
    configured: true
    days: number
    ga4: unknown
    gsc: unknown
  } = { connected: true, configured: true, days: DAYS, ga4: null, gsc: null }

  if (integration.ga4_property_id) {
    try {
      const [summary, sources, topPages] = await Promise.all([
        getGA4Report(integration.ga4_property_id, DAYS),
        getGA4TrafficSources(integration.ga4_property_id, DAYS),
        getGA4TopPages(integration.ga4_property_id, DAYS, 10),
      ])
      result.ga4 = { summary, sources, topPages }
    } catch (err) {
      // A live Google API failure (expired token, revoked access, etc.)
      // must not take down the whole dashboard response — the plugin
      // just shows this one section as unavailable.
      console.error('[wordpress/seo/analytics] GA4 fetch failed', err)
    }
  }

  if (integration.gsc_site_url) {
    try {
      result.gsc = await getGSCSummary(integration.gsc_site_url, DAYS)
    } catch (err) {
      console.error('[wordpress/seo/analytics] GSC fetch failed', err)
    }
  }

  return NextResponse.json(result)
})
