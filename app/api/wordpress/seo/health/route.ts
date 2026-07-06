import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

async function validateApiKey(req: NextRequest): Promise<boolean> {
  const key = req.headers.get('x-gravhub-key')
  if (!key) return false
  const db = createServiceClient()
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'wordpress_api_keys')
    .maybeSingle()
  if (!data) return key === process.env.WORDPRESS_API_KEY
  const keys = (data as { value: string[] }).value
  return Array.isArray(keys) && keys.includes(key)
}

export async function POST(req: NextRequest) {
  if (!(await validateApiKey(req))) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

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

export async function GET() {
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
