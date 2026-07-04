import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runAndStoreWPCheck } from '@/lib/wordpress'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const result = await runAndStoreWPCheck(id)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'WordPress check failed' },
      { status: 500 },
    )
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
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
}
