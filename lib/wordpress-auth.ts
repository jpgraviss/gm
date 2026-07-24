import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

type StoredApiKey = string | { key: string; siteUrl?: string }

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * AUDIT #344 — API keys were validated as a flat pool with no binding to
 * the site they were issued for, so any one valid key could read/overwrite
 * SEO data (meta tags, OG/schema markup, scores) for ANY siteUrl a caller
 * named, not just the site it was meant for. Keys generated going forward
 * carry an optional `siteUrl`; when present, the caller's own `siteUrl`
 * (every route in app/api/wordpress/seo/* already requires one) must match
 * by hostname. Keys with no `siteUrl` — every key issued before this fix,
 * already embedded in live client plugin installs — stay unscoped rather
 * than breaking on deploy; the Settings UI flags them so staff can migrate
 * to scoped keys over time.
 *
 * `expectedSiteUrl` is optional so routes that don't yet pass it (or the
 * session-cookie fallback path, which isn't key-based at all) keep working
 * exactly as before.
 */
export async function requireWordPressAuth(req: NextRequest, expectedSiteUrl?: string | null): Promise<NextResponse | null> {
  const key = req.headers.get('x-gravhub-key')

  if (key) {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('wordpress')
      .eq('id', 'global')
      .maybeSingle()

    if (data) {
      const wp = data.wordpress as { apiKeys?: StoredApiKey[] } | null
      if (wp && Array.isArray(wp.apiKeys)) {
        const matched = wp.apiKeys.find(k => (typeof k === 'string' ? k : k.key) === key)
        if (matched) {
          const boundSite = typeof matched === 'string' ? undefined : matched.siteUrl
          if (boundSite && expectedSiteUrl) {
            const boundHost = hostnameOf(boundSite)
            const requestHost = hostnameOf(expectedSiteUrl)
            if (!boundHost || !requestHost || boundHost !== requestHost) {
              return NextResponse.json({ error: 'This API key is not authorized for this site' }, { status: 403 })
            }
          }
          return null
        }
      }
    }

    if (key === process.env.WORDPRESS_API_KEY) return null
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // The session fallback (used by the staff SEO-manager UI, not the plugin
  // itself) previously only proved "some valid session" — getAuthenticatedEmail
  // resolves for a portal client exactly the same as staff. Any portal
  // client could read/overwrite another client's live WordPress SEO
  // settings (meta title/description/OG/schema — a real defacement
  // vector). Require real team_members membership.
  const email = await getAuthenticatedEmail(req)
  if (email && (await isStaffCaller(req))) return null

  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}
