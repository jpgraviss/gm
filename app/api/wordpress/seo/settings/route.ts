import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('wordpress/seo/settings GET', async (req) => {
  const siteUrl = req.nextUrl.searchParams.get('site')
  if (!siteUrl) {
    return NextResponse.json({ error: 'site query param is required' }, { status: 400 })
  }

  const denied = await requireWordPressAuth(req, siteUrl)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_seo_settings')
    .select('*')
    .eq('site_url', siteUrl)
    .order('page_path')

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data ?? [])
})

export const PATCH = withErrorHandler('wordpress/seo/settings PATCH', async (req) => {
  const body = await req.json()
  const { siteUrl, pagePath, metaTitle, metaDescription, ogTitle, ogDescription, ogImage, schemaMarkup } = body

  if (!siteUrl || !pagePath) {
    return NextResponse.json({ error: 'siteUrl and pagePath are required' }, { status: 400 })
  }

  const denied = await requireWordPressAuth(req, siteUrl)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_seo_settings')
    .upsert({
      id: `wss-${Buffer.from(`${siteUrl}:${pagePath}`).toString('base64url').slice(0, 30)}`,
      site_url: siteUrl,
      page_path: pagePath,
      meta_title: metaTitle ?? null,
      meta_description: metaDescription ?? null,
      og_title: ogTitle ?? null,
      og_description: ogDescription ?? null,
      og_image: ogImage ?? null,
      schema_markup: schemaMarkup ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site_url,page_path' })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data)
})
