import { createServiceClient } from '@/lib/supabase'
import { getGSCSummary, getGSCSearchAnalytics } from '@/lib/google-search-console'
import { getGA4Report, getGA4TopPages } from '@/lib/google-analytics'
import { getGBPSummary } from '@/lib/google-business-profile'

/**
 * White-label monthly client report.
 *
 * Aggregates data across GSC, GA4, GBP, rank tracker, and uptime monitor
 * for one client company over a given date window. The shape is consumed
 * by the PDF generator in `components/reports/ClientReportPDF.tsx` and
 * the on-screen preview at /app/reports/client/[id]/page.tsx.
 */

export interface ClientReportConfig {
  companyName: string
  companyId?: string
  gscSiteUrl?: string
  ga4PropertyId?: string
  gbpLocationName?: string
  startDate: string // YYYY-MM-DD
  endDate:   string
}

export interface ClientReportData {
  company: { name: string; id?: string }
  period:  { start: string; end: string; label: string }
  seo?: {
    clicks: number
    impressions: number
    avgPosition: number
    ctr: number
    topQueries: Array<{ keyword: string; clicks: number; impressions: number; position: number }>
  }
  traffic?: {
    sessions: number
    users: number
    pageviews: number
    avgSessionDurationSec: number
    bounceRate: number
    topPages: Array<{ path: string; title: string; sessions: number }>
  }
  reputation?: {
    newReviews: number
    averageRating: number
    totalReviews: number
  }
  ranking?: {
    tracked: number
    top3: number
    top10: number
    improved: number
    declined: number
    keywords: Array<{ keyword: string; position: number; change: number }>
  }
  uptime?: {
    sitesMonitored: number
    uptimePercent: number
    incidents: number
  }
}

function daysBetween(start: string, end: string): number {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (24 * 60 * 60 * 1000)))
}

function monthLabel(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

/**
 * Build a complete client report from all configured data sources.
 * Sources that fail are omitted silently so one broken integration doesn't
 * kill the whole report.
 */
export async function buildClientReport(config: ClientReportConfig): Promise<ClientReportData> {
  const days = daysBetween(config.startDate, config.endDate)
  const result: ClientReportData = {
    company: { name: config.companyName, id: config.companyId },
    period: {
      start: config.startDate,
      end: config.endDate,
      label: monthLabel(config.startDate, config.endDate),
    },
  }

  // ── SEO via Search Console ─────────────────────────────────────────────
  if (config.gscSiteUrl) {
    try {
      const [summary, topQueries] = await Promise.all([
        getGSCSummary(config.gscSiteUrl, days),
        getGSCSearchAnalytics({
          siteUrl: config.gscSiteUrl,
          startDate: config.startDate,
          endDate: config.endDate,
          dimensions: ['query'],
          rowLimit: 20,
        }),
      ])
      result.seo = {
        clicks: summary.totalClicks,
        impressions: summary.totalImpressions,
        avgPosition: summary.avgPosition,
        ctr: summary.avgCtr,
        topQueries: topQueries.map((r) => ({
          keyword: r.keys?.[0] ?? '',
          clicks: r.clicks,
          impressions: r.impressions,
          position: r.position,
        })),
      }
    } catch (err) {
      console.error('[client-report] GSC pull failed', err)
    }
  }

  // ── Traffic via GA4 ────────────────────────────────────────────────────
  if (config.ga4PropertyId) {
    try {
      const [ga4, topPages] = await Promise.all([
        getGA4Report(config.ga4PropertyId, days),
        getGA4TopPages(config.ga4PropertyId, days, 10),
      ])
      result.traffic = {
        sessions:              ga4.sessions ?? 0,
        users:                 ga4.users ?? 0,
        pageviews:             ga4.pageviews ?? 0,
        avgSessionDurationSec: ga4.avgSessionDurationSec ?? 0,
        bounceRate:            ga4.bounceRate ?? 0,
        topPages:              topPages.slice(0, 10).map((p) => ({
          path: p.path,
          title: p.title,
          sessions: p.sessions,
        })),
      }
    } catch (err) {
      console.error('[client-report] GA4 pull failed', err)
    }
  }

  // ── Reputation via Business Profile ────────────────────────────────────
  if (config.gbpLocationName) {
    try {
      const summary = await getGBPSummary(config.gbpLocationName, days)
      result.reputation = {
        newReviews:     summary.newReviews,
        averageRating:  summary.averageRating,
        totalReviews:   summary.totalReviewCount,
      }
    } catch (err) {
      console.error('[client-report] GBP pull failed', err)
    }
  }

  // ── Rank tracker (reads from local DB — always safe) ───────────────────
  try {
    const db = createServiceClient()
    const { data: keywords } = await db
      .from('tracked_keywords')
      .select('keyword, current_position, previous_position')
      .eq('company_name', config.companyName)

    if (keywords && keywords.length > 0) {
      const rows = keywords as Array<{ keyword: string; current_position: number | null; previous_position: number | null }>
      const top3 = rows.filter((k) => (k.current_position ?? 100) <= 3).length
      const top10 = rows.filter((k) => (k.current_position ?? 100) <= 10).length
      const improved = rows.filter((k) => (k.previous_position ?? 100) > (k.current_position ?? 100)).length
      const declined = rows.filter((k) => (k.previous_position ?? 100) < (k.current_position ?? 100)).length
      result.ranking = {
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
  } catch (err) {
    console.error('[client-report] rank tracker read failed', err)
  }

  // ── Uptime ─────────────────────────────────────────────────────────────
  try {
    const db = createServiceClient()
    const { data: sites } = await db
      .from('monitored_sites')
      .select('id, uptime_30d, status')
      .eq('company_name', config.companyName)

    if (sites && sites.length > 0) {
      const rows = sites as Array<{ id: string; uptime_30d: number | null; status: string }>
      const avgUptime = rows.reduce((sum, s) => sum + (s.uptime_30d ?? 100), 0) / rows.length
      const siteIds = rows.map((s) => s.id)
      const { data: incidents } = await db
        .from('uptime_checks')
        .select('id')
        .in('site_id', siteIds)
        .eq('up', false)
        .gte('checked_at', config.startDate)
        .lte('checked_at', config.endDate)
      result.uptime = {
        sitesMonitored: rows.length,
        uptimePercent: Math.round(avgUptime * 100) / 100,
        incidents: (incidents ?? []).length,
      }
    }
  } catch (err) {
    console.error('[client-report] uptime read failed', err)
  }

  return result
}

/**
 * Save a report snapshot to client_data_snapshots for historical comparisons.
 */
export async function saveReportSnapshot(report: ClientReportData): Promise<void> {
  const db = createServiceClient()
  const baseId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const entries: Array<{ product: string; metrics: Record<string, unknown> }> = []

  if (report.seo) entries.push({ product: 'search_console', metrics: report.seo })
  if (report.traffic) entries.push({ product: 'analytics', metrics: report.traffic })
  if (report.reputation) entries.push({ product: 'business_profile', metrics: report.reputation })
  if (report.ranking) entries.push({ product: 'rank_tracker', metrics: report.ranking })
  if (report.uptime) entries.push({ product: 'uptime', metrics: report.uptime })

  for (const entry of entries) {
    await db.from('client_data_snapshots').insert({
      id: `${baseId}-${entry.product}`,
      company_id: report.company.id ?? null,
      company_name: report.company.name,
      product: entry.product,
      period_start: report.period.start,
      period_end: report.period.end,
      metrics: entry.metrics,
    })
  }
}
