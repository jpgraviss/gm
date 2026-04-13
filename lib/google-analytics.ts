import { getValidMarketingToken } from '@/lib/google-marketing'

/**
 * Google Analytics 4 API wrapper.
 * API docs:
 *   Admin: https://developers.google.com/analytics/devguides/config/admin/v1
 *   Data:  https://developers.google.com/analytics/devguides/reporting/data/v1
 */

async function ga4Fetch<T>(url: string, init?: RequestInit): Promise<T> {
  const auth = await getValidMarketingToken('analytics')
  if (!auth) throw new Error('Google Analytics not connected')

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GA4 ${url} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

export interface GA4Property {
  /** Stable id used by UI — the numeric property id. */
  id: string
  displayName: string
  /** Numeric property id (no "properties/" prefix). */
  propertyId: string
  accountName: string
}

interface AccountSummariesResponse {
  accountSummaries?: Array<{
    account: string
    displayName: string
    propertySummaries?: Array<{
      property: string          // "properties/123456789"
      displayName: string
      propertyType?: string
    }>
  }>
}

/**
 * List all GA4 properties the authorized account has access to, flattened
 * across account summaries.
 */
export async function listGA4Properties(): Promise<GA4Property[]> {
  const data = await ga4Fetch<AccountSummariesResponse>(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
  )

  const out: GA4Property[] = []
  for (const acc of data.accountSummaries ?? []) {
    for (const prop of acc.propertySummaries ?? []) {
      const propertyId = prop.property.replace(/^properties\//, '')
      out.push({
        id: propertyId,
        displayName: prop.displayName,
        propertyId,
        accountName: acc.displayName,
      })
    }
  }
  return out
}

interface RunReportResponse {
  dimensionHeaders?: Array<{ name: string }>
  metricHeaders?: Array<{ name: string; type?: string }>
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>
    metricValues?: Array<{ value?: string }>
  }>
  totals?: Array<{
    metricValues?: Array<{ value?: string }>
  }>
  rowCount?: number
}

interface RunReportRequest {
  dateRanges: Array<{ startDate: string; endDate: string }>
  dimensions?: Array<{ name: string }>
  metrics: Array<{ name: string }>
  orderBys?: Array<{
    metric?: { metricName: string }
    dimension?: { dimensionName: string }
    desc?: boolean
  }>
  limit?: string
  keepEmptyRows?: boolean
}

async function runReport(propertyId: string, body: RunReportRequest): Promise<RunReportResponse> {
  const cleanId = propertyId.replace(/^properties\//, '')
  return ga4Fetch<RunReportResponse>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${cleanId}:runReport`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

function daysAgoRange(days: number): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

function num(value: string | undefined): number {
  if (!value) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export interface GA4Summary {
  sessions: number
  users: number
  pageviews: number
  avgSessionDurationSec: number
  bounceRate: number
}

/**
 * Core metrics for a property over the last N days.
 */
export async function getGA4Report(propertyId: string, days = 28): Promise<GA4Summary> {
  const data = await runReport(propertyId, {
    dateRanges: [daysAgoRange(days)],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
  })

  const totals = data.totals?.[0]?.metricValues ?? data.rows?.[0]?.metricValues ?? []
  return {
    sessions:              num(totals[0]?.value),
    users:                 num(totals[1]?.value),
    pageviews:             num(totals[2]?.value),
    avgSessionDurationSec: num(totals[3]?.value),
    bounceRate:            num(totals[4]?.value),
  }
}

export interface GA4TopPage {
  path: string
  title: string
  sessions: number
  pageviews: number
}

/**
 * Top pages by sessions for a property over the last N days.
 */
export async function getGA4TopPages(
  propertyId: string,
  days = 28,
  limit = 20,
): Promise<GA4TopPage[]> {
  const data = await runReport(propertyId, {
    dateRanges: [daysAgoRange(days)],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: String(limit),
  })

  return (data.rows ?? []).map((row) => ({
    path:      row.dimensionValues?.[0]?.value ?? '',
    title:     row.dimensionValues?.[1]?.value ?? '',
    sessions:  num(row.metricValues?.[0]?.value),
    pageviews: num(row.metricValues?.[1]?.value),
  }))
}

export interface GA4TrafficSource {
  channel: string
  sessions: number
  users: number
}

/**
 * Sessions grouped by default channel group for a property over the last N days.
 */
export async function getGA4TrafficSources(
  propertyId: string,
  days = 28,
): Promise<GA4TrafficSource[]> {
  const data = await runReport(propertyId, {
    dateRanges: [daysAgoRange(days)],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: '25',
  })

  return (data.rows ?? []).map((row) => ({
    channel:  row.dimensionValues?.[0]?.value ?? '(not set)',
    sessions: num(row.metricValues?.[0]?.value),
    users:    num(row.metricValues?.[1]?.value),
  }))
}
