import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'
import { withErrorHandler } from '@/lib/api-handler'
import { validate, validationError } from '@/lib/validation'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('wordpress/seo/health POST', async (req) => {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const body = await req.json()

  const siteUrl = body.siteUrl ?? body.site_url
  const companyName = body.companyName ?? body.site_name ?? body.company_name

  if (!siteUrl || !companyName) {
    return NextResponse.json({ error: 'siteUrl and companyName are required' }, { status: 400 })
  }

  const wpVersion = body.wpVersion ?? body.wp_version ?? (body.wordpress?.version ?? null)
  const phpVersion = body.phpVersion ?? body.php_version ?? (body.php?.version ?? null)

  let plugins = body.plugins ?? body.active_plugins ?? []
  if (!Array.isArray(plugins)) plugins = []

  let themes = body.themes ?? []
  if (!Array.isArray(themes)) themes = []
  const activeTheme = body.active_theme
  if (activeTheme && typeof activeTheme === 'object' && themes.length === 0) {
    themes = [{ ...activeTheme, active: true }]
  }

  const security = body.security ?? {}
  const sitemap = body.sitemap ?? null
  const securityNormalized: Record<string, unknown> = {}
  if (security.wp_login_exposed !== undefined) securityNormalized.login_exposed = security.wp_login_exposed
  if (security.xmlrpc_enabled !== undefined) securityNormalized.xmlrpc_enabled = security.xmlrpc_enabled
  if (security.directory_listing_enabled !== undefined) securityNormalized.directory_listing = security.directory_listing_enabled
  if (sitemap && typeof sitemap === 'object') securityNormalized.sitemap_found = sitemap.has_sitemap ?? false
  if (Object.keys(securityNormalized).length === 0) Object.assign(securityNormalized, security)

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_site_health')
    .upsert({
      id: `wsh-${Buffer.from(siteUrl).toString('base64url').slice(0, 20)}`,
      company_name: companyName,
      site_url: siteUrl,
      wp_version: wpVersion,
      php_version: phpVersion,
      plugins,
      themes,
      security: securityNormalized,
      last_reported_at: new Date().toISOString(),
    }, { onConflict: 'site_url' })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data)
})

export const GET = withErrorHandler('wordpress/seo/health GET', async (req) => {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const companyId = req.nextUrl.searchParams.get('companyId')

  const db = createServiceClient()
  let query = db
    .from('wordpress_site_health')
    .select('*')
    .order('company_name')
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data ?? [])
})

// Staff-only: assign (or clear) a connected site's CRM company. Deliberately
// NOT gated by requireWordPressAuth — the plugin's own X-GravHub-Key must
// not be able to reassign which client it's billed against.
export const PATCH = withErrorHandler('wordpress/seo/health PATCH', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    id: { required: true, type: 'string' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_site_health')
    .update({ company_id: body.companyId ?? null })
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data)
})
