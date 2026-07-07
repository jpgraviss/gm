import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'

export async function POST(req: NextRequest) {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const body = await req.json()
  const { siteUrl, pages } = body as {
    siteUrl: string
    pages: Array<{
      pagePath: string
      pageTitle?: string
      score: number
      issues: Array<{ type: string; message: string; severity: string }>
    }>
  }

  if (!siteUrl || !Array.isArray(pages)) {
    return NextResponse.json({ error: 'siteUrl and pages array required' }, { status: 400 })
  }

  const db = createServiceClient()
  const now = new Date().toISOString()

  const rows = pages.map(p => ({
    id: `wsc-${Buffer.from(`${siteUrl}:${p.pagePath}`).toString('base64url').slice(0, 30)}`,
    site_url: siteUrl,
    page_path: p.pagePath,
    page_title: p.pageTitle ?? null,
    score: p.score,
    issues: p.issues ?? [],
    checked_at: now,
  }))

  const { error } = await db
    .from('wordpress_seo_scores')
    .upsert(rows, { onConflict: 'site_url,page_path' })

  if (error) {
    console.error('[wordpress/seo/scores POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: rows.length })
}

export async function GET(req: NextRequest) {
  const denied = await requireWordPressAuth(req)
  if (denied) return denied

  const siteUrl = req.nextUrl.searchParams.get('site')
  if (!siteUrl) {
    return NextResponse.json({ error: 'site query param is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('wordpress_seo_scores')
    .select('*')
    .eq('site_url', siteUrl)
    .order('score', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
