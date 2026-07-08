import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

export const GET = withErrorHandler('delivery/monthly-report/[id] GET', async (_req, ctx) => {
  const { id } = await ctx!.params
  if (!id) return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 })

  const db = createServiceClient()

  const { data: workflow, error: wfErr } = await db
    .from('delivery_workflows')
    .select('*')
    .eq('id', id)
    .single()

  if (wfErr) {
    if (wfErr.code === 'PGRST116') {
      return NextResponse.json({ error: wfErr.message }, { status: 404 })
    }
    throw new Error(wfErr.message)
  }

  const companyName = workflow.company_name as string
  const companyId = workflow.company_id as string | null

  const now = new Date()
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
  const prevEnd = new Date(periodStart.getTime() - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const periodStartStr = fmt(periodStart)
  const periodEndStr = fmt(periodEnd)
  const prevStartStr = fmt(prevStart)
  const prevEndStr = fmt(prevEnd)

  const monthLabel = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const result: Record<string, unknown> = {
    clientName: companyName,
    companyName: 'Graviss Marketing',
    period: { start: periodStartStr, end: periodEndStr, label: monthLabel },
  }

  const metrics: Record<string, unknown> = {}

  const snapshotFilter = companyId ? { column: 'company_id', value: companyId } : { column: 'company_name', value: companyName }

  const [currentSnapshots, previousSnapshots] = await Promise.all([
    db.from('client_data_snapshots')
      .select('product, metrics')
      .eq(snapshotFilter.column, snapshotFilter.value)
      .gte('period_start', periodStartStr)
      .lte('period_end', periodEndStr),
    db.from('client_data_snapshots')
      .select('product, metrics')
      .eq(snapshotFilter.column, snapshotFilter.value)
      .gte('period_start', prevStartStr)
      .lte('period_end', prevEndStr),
  ])

  const currentMap = new Map<string, Record<string, unknown>>()
  for (const row of currentSnapshots.data ?? []) {
    currentMap.set(row.product, row.metrics as Record<string, unknown>)
  }
  const prevMap = new Map<string, Record<string, unknown>>()
  for (const row of previousSnapshots.data ?? []) {
    prevMap.set(row.product, row.metrics as Record<string, unknown>)
  }

  const analyticsSnap = currentMap.get('analytics')
  const prevAnalytics = prevMap.get('analytics')
  if (analyticsSnap) {
    metrics.traffic = {
      sessions: analyticsSnap.sessions ?? 0,
      users: analyticsSnap.users ?? 0,
      pageviews: analyticsSnap.pageviews ?? 0,
      bounceRate: analyticsSnap.bounceRate ?? 0,
      previousSessions: prevAnalytics ? (prevAnalytics.sessions ?? undefined) : undefined,
      previousUsers: prevAnalytics ? (prevAnalytics.users ?? undefined) : undefined,
    }
  }

  const seoSnap = currentMap.get('search_console')
  const prevSeo = prevMap.get('search_console')
  if (seoSnap) {
    metrics.seo = {
      clicks: seoSnap.clicks ?? 0,
      impressions: seoSnap.impressions ?? 0,
      avgPosition: seoSnap.avgPosition ?? 0,
      ctr: seoSnap.ctr ?? 0,
      previousClicks: prevSeo ? (prevSeo.clicks ?? undefined) : undefined,
      previousImpressions: prevSeo ? (prevSeo.impressions ?? undefined) : undefined,
    }
  }

  const { data: keywords } = await db
    .from('tracked_keywords')
    .select('keyword, current_position, previous_position')
    .eq('company_name', companyName)

  if (keywords && keywords.length > 0) {
    type KRow = { keyword: string; current_position: number | null; previous_position: number | null }
    const rows = keywords as KRow[]
    const top3 = rows.filter((k) => (k.current_position ?? 100) <= 3).length
    const top10 = rows.filter((k) => (k.current_position ?? 100) <= 10).length
    const improved = rows.filter((k) => (k.previous_position ?? 100) > (k.current_position ?? 100)).length
    const declined = rows.filter((k) => (k.previous_position ?? 100) < (k.current_position ?? 100)).length

    const { data: history } = await db
      .from('keyword_rank_history')
      .select('tracked_keyword_id, position, checked_at')
      .in('tracked_keyword_id', rows.map((k) => (k as unknown as { id: string }).id).filter(Boolean))
      .gte('checked_at', periodStartStr)
      .lte('checked_at', periodEndStr)
      .order('checked_at', { ascending: false })

    void history

    metrics.ranking = {
      tracked: rows.length,
      top3,
      top10,
      improved,
      declined,
      keywords: rows.slice(0, 20).map((k) => ({
        keyword: k.keyword,
        position: k.current_position ?? 0,
        change: (k.previous_position ?? k.current_position ?? 0) - (k.current_position ?? 0),
      })),
    }
  }

  const reviewFilter = companyId
    ? db.from('reviews').select('rating, date').eq('company_id', companyId)
    : db.from('reviews').select('rating, date')
  const { data: reviews } = await reviewFilter
  if (reviews && reviews.length > 0) {
    type RRow = { rating: number; date: string }
    const allReviews = reviews as RRow[]
    const periodReviews = allReviews.filter((r) => r.date >= periodStartStr && r.date <= periodEndStr)
    const prevReviews = allReviews.filter((r) => r.date >= prevStartStr && r.date <= prevEndStr)
    const avgRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length

    metrics.reputation = {
      newReviews: periodReviews.length,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: allReviews.length,
      previousTotalReviews: allReviews.length - periodReviews.length + prevReviews.length,
    }
  }

  const { data: sites } = await db
    .from('monitored_sites')
    .select('id, uptime_30d, status')
    .eq('company_name', companyName)

  if (sites && sites.length > 0) {
    type SRow = { id: string; uptime_30d: number | null; status: string }
    const rows = sites as SRow[]
    const avgUptime = rows.reduce((s, r) => s + (r.uptime_30d ?? 100), 0) / rows.length
    const siteIds = rows.map((s) => s.id)

    const { data: incidents } = await db
      .from('uptime_checks')
      .select('id')
      .in('site_id', siteIds)
      .eq('up', false)
      .gte('checked_at', periodStartStr)
      .lte('checked_at', periodEndStr)

    metrics.uptime = {
      sitesMonitored: rows.length,
      uptimePercent: Math.round(avgUptime * 100) / 100,
      incidents: (incidents ?? []).length,
    }
  }

  const { data: projects } = await db
    .from('projects')
    .select('company, status, progress')
    .eq('company', companyName)

  const changelog: string[] = []
  if (projects && projects.length > 0) {
    for (const p of projects) {
      const proj = p as { company: string; status: string; progress: number }
      if (proj.status === 'Completed' || proj.status === 'Launched') {
        changelog.push(`Project completed: ${proj.company} (${proj.status})`)
      }
    }
  }

  result.metrics = metrics
  result.recommendations = []
  result.changelog = changelog

  return NextResponse.json(result)
})
