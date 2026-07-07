import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'

export async function POST(req: NextRequest) {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const body = await req.json()
  const { siteUrl, companyName, wpVersion, phpVersion, plugins, themes, security } = body

  if (!siteUrl || !companyName) {
    return NextResponse.json({ error: 'siteUrl and companyName are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_site_health')
    .upsert({
      id: `wsh-${Buffer.from(siteUrl).toString('base64url').slice(0, 20)}`,
      company_name: companyName,
      site_url: siteUrl,
      wp_version: wpVersion ?? null,
      php_version: phpVersion ?? null,
      plugins: plugins ?? [],
      themes: themes ?? [],
      security: security ?? {},
      last_reported_at: new Date().toISOString(),
    }, { onConflict: 'site_url' })
    .select()
    .single()

  if (error) {
    console.error('[wordpress/seo/health POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(req: NextRequest) {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_site_health')
    .select('*')
    .order('company_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
