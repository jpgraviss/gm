import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { sendSingleReport } from '@/lib/seo-report-sender'
import { withErrorHandler } from '@/lib/api-handler'

interface SeoMetrics { clicks?: number; impressions?: number; avgPosition?: number }
interface AnalyticsMetrics { sessions?: number }

interface PeriodGroup {
  periodStart: string
  periodEnd: string
  search_console?: SeoMetrics
  analytics?: AnalyticsMetrics
}

function pctChange(curr: number | undefined, prior: number | undefined): number | undefined {
  if (curr === undefined || prior === undefined || prior === 0) return undefined
  return ((curr - prior) / prior) * 100
}

export const GET = withErrorHandler('seo-reports/[companyId] GET', async (req, { params }: { params: Promise<{ companyId: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { companyId } = await params
  const db = createServiceClient()

  const { data: snapshots, error } = await db
    .from('client_data_snapshots')
    .select('*')
    .eq('company_id', companyId)
    .order('period_end', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message || 'Failed to fetch snapshots')
  }

  // client_data_snapshots stores one row per (period, product) — group by
  // period first, matching how lib/client-reports.ts writes them.
  const grouped = new Map<string, PeriodGroup>()
  for (const snap of (snapshots ?? []) as Array<{ period_start: string; period_end: string; product: string; metrics: Record<string, unknown> }>) {
    const key = `${snap.period_start}_${snap.period_end}`
    if (!grouped.has(key)) grouped.set(key, { periodStart: snap.period_start, periodEnd: snap.period_end })
    const group = grouped.get(key)!
    if (snap.product === 'search_console') group.search_console = snap.metrics as SeoMetrics
    if (snap.product === 'analytics') group.analytics = snap.metrics as AnalyticsMetrics
  }

  // Oldest-first so period-over-period change can compare against the
  // prior (older) period, then reversed back to newest-first for display —
  // the frontend's ReportSnapshot shape (flat clicks/impressions/
  // avg_position/sessions + *_change) previously didn't match what this
  // route returned at all (nested per-product objects, no period label,
  // no change calc), so every expanded history row crashed formatting
  // undefined as a number.
  const periods = [...grouped.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))

  const rows = periods.map((p, i) => {
    const prev = periods[i - 1]
    const seo = p.search_console
    const analytics = p.analytics
    const prevSeo = prev?.search_console
    const prevAnalytics = prev?.analytics

    return {
      period: new Date(`${p.periodEnd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      clicks: seo?.clicks ?? 0,
      impressions: seo?.impressions ?? 0,
      avg_position: seo?.avgPosition ?? 0,
      sessions: analytics?.sessions ?? 0,
      clicks_change: pctChange(seo?.clicks, prevSeo?.clicks),
      impressions_change: pctChange(seo?.impressions, prevSeo?.impressions),
      sessions_change: pctChange(analytics?.sessions, prevAnalytics?.sessions),
    }
  })

  return NextResponse.json(rows.reverse())
})

export const POST = withErrorHandler('seo-reports/[companyId] POST', async (req, { params }: { params: Promise<{ companyId: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { companyId } = await params
  const db = createServiceClient()

  const { data: integration } = await db
    .from('client_integrations')
    .select('company_name')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ error: 'No integration found for this company' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const { recipientOverride, preview } = body as { recipientOverride?: string; preview?: boolean }

  const result = await sendSingleReport(
    (integration as { company_name: string }).company_name,
    { recipientOverride, preview },
  )
  return NextResponse.json(result)
})
