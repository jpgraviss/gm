import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireWordPressAuth } from '@/lib/wordpress-auth'
import { withErrorHandler } from '@/lib/api-handler'

type Bucket = '1-3' | '4-10' | '11-20' | '21-50' | '50+'

// Same bucket boundaries as app/rank-tracker/page.tsx's positionBucket() —
// kept in sync deliberately rather than imported, since that file's version
// returns 'none' for unranked keywords and this one just omits them from
// every bucket instead (there's no "not ranked" tile on the plugin dashboard).
function positionBucket(pos: number | null): Bucket | null {
  if (pos == null) return null
  if (pos <= 3) return '1-3'
  if (pos <= 10) return '4-10'
  if (pos <= 20) return '11-20'
  if (pos <= 50) return '21-50'
  return '50+'
}

interface TrackedKeywordRow {
  id: string
  keyword: string
  current_position: number | null
  previous_position: number | null
  best_position: number | null
  last_checked_at: string | null
  target_url: string | null
}

/**
 * Keyword position summary for the WordPress plugin's dashboard — position
 * buckets (Top 3 / 4-10 / 11-20 / 21-50 / 50+) and winning/losing keywords,
 * ported from the same logic app/rank-tracker/page.tsx already computes
 * client-side (no shared server function existed to call instead).
 */
export const GET = withErrorHandler('wordpress/seo/keywords GET', async (req) => {
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
    return NextResponse.json({ connected: false })
  }

  const { data, error } = await db
    .from('tracked_keywords')
    .select('id, keyword, current_position, previous_position, best_position, last_checked_at, target_url')
    .eq('company_id', health.company_id)
    .order('current_position', { ascending: true, nullsFirst: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as TrackedKeywordRow[]

  const buckets: Record<Bucket, number> = { '1-3': 0, '4-10': 0, '11-20': 0, '21-50': 0, '50+': 0 }
  for (const kw of rows) {
    const bucket = positionBucket(kw.current_position)
    if (bucket) buckets[bucket]++
  }

  // delta > 0 means the keyword moved UP in results (position number went
  // down) — previous minus current, matching the sign convention used for
  // "improved"/"declined" in lib/client-reports.ts.
  const withDelta = rows
    .filter((kw) => kw.current_position != null && kw.previous_position != null)
    .map((kw) => ({ ...kw, delta: (kw.previous_position as number) - (kw.current_position as number) }))

  const winning = [...withDelta].filter((k) => k.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
  const losing = [...withDelta].filter((k) => k.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5)

  return NextResponse.json({
    connected: true,
    total: rows.length,
    buckets,
    winning,
    losing,
    keywords: rows,
  })
})
