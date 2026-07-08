import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runAndStoreWPCheck } from '@/lib/wordpress'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('monitored-sites/[id]/wordpress POST', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  const { data: site, error } = await db
    .from('monitored_sites')
    .select('id, url')
    .eq('id', id)
    .maybeSingle()

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 })
  }

  const result = await runAndStoreWPCheck(id)
  return NextResponse.json(result)
})

export const GET = withErrorHandler('monitored-sites/[id]/wordpress GET', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('wordpress_checks')
    .select('*')
    .eq('site_id', id)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error?.message || 'Failed to fetch WordPress check')
  }

  if (!data) {
    return NextResponse.json({ checked: false })
  }

  return NextResponse.json({
    checked: true,
    isWordPress: data.is_wordpress,
    wpVersion: data.wp_version,
    siteTitle: data.site_title,
    plugins: data.plugins ?? [],
    themes: data.themes ?? [],
    coreUpdateAvailable: data.core_update_available,
    securityHeaders: data.security_headers ?? {},
    loginPageExposed: data.login_page_exposed,
    xmlRpcEnabled: data.xmlrpc_enabled,
    checkedAt: data.checked_at,
  })
})
