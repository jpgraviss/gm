import { getValidMarketingToken } from '@/lib/google-marketing'

/**
 * Google Search Console API wrapper.
 * API docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 */

async function gscFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await getValidMarketingToken('search_console')
  if (!auth) throw new Error('Google Search Console not connected')

  const res = await fetch(`https://www.googleapis.com/webmasters/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GSC ${path} failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<T>
}

export interface GSCProperty {
  siteUrl: string
  permissionLevel: string
}

/**
 * List all sites the authorized account has access to.
 */
export async function listGSCProperties(): Promise<GSCProperty[]> {
  const data = await gscFetch<{ siteEntry: GSCProperty[] }>('/sites')
  return data.siteEntry ?? []
}

export interface GSCSearchRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * Fetch search analytics for a given site over a date range.
 * Dimensions determine grouping ('query', 'page', 'country', 'device', 'date').
 */
export async function getGSCSearchAnalytics(params: {
  siteUrl: string
  startDate: string  // YYYY-MM-DD
  endDate:   string
  dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'date'>
  rowLimit?: number
}): Promise<GSCSearchRow[]> {
  const body = {
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: params.dimensions ?? ['query'],
    rowLimit: params.rowLimit ?? 100,
    dataState: 'final',
  }

  const encodedSite = encodeURIComponent(params.siteUrl)
  const data = await gscFetch<{ rows?: GSCSearchRow[] }>(
    `/sites/${encodedSite}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return data.rows ?? []
}

/**
 * Get summary metrics for a site over the last N days.
 */
export async function getGSCSummary(siteUrl: string, days = 28): Promise<{
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
}> {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const rows = await getGSCSearchAnalytics({
    siteUrl,
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: [],
    rowLimit: 1,
  })

  const row = rows[0]
  return {
    totalClicks:      row?.clicks ?? 0,
    totalImpressions: row?.impressions ?? 0,
    avgCtr:           row?.ctr ?? 0,
    avgPosition:      row?.position ?? 0,
  }
}

export interface GSCSitemap {
  path: string
  lastSubmitted?: string
  isPending: boolean
  isSitemapsIndex: boolean
  lastDownloaded?: string
  warnings: number
  errors: number
}

export async function getGSCSitemaps(siteUrl: string): Promise<GSCSitemap[]> {
  const encodedSite = encodeURIComponent(siteUrl)
  const data = await gscFetch<{ sitemap?: GSCSitemap[] }>(
    `/sites/${encodedSite}/sitemaps`,
  )
  return (data.sitemap ?? []).map(s => ({
    path: s.path,
    lastSubmitted: s.lastSubmitted,
    isPending: s.isPending ?? false,
    isSitemapsIndex: s.isSitemapsIndex ?? false,
    lastDownloaded: s.lastDownloaded,
    warnings: s.warnings ?? 0,
    errors: s.errors ?? 0,
  }))
}

export interface GSCIndexCoverage {
  valid: number
  warning: number
  excluded: number
  error: number
}

export async function getGSCIndexCoverage(siteUrl: string): Promise<GSCIndexCoverage> {
  const encodedSite = encodeURIComponent(siteUrl)
  try {
    const data = await gscFetch<{
      verdict?: { coverageState?: string }
      inspectionResult?: Record<string, unknown>
    }>(
      `/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          dimensions: ['page'],
          rowLimit: 5000,
          dataState: 'final',
        }),
      },
    )
    const pages = (data as unknown as { rows?: GSCSearchRow[] }).rows ?? []
    return {
      valid: pages.length,
      warning: 0,
      excluded: 0,
      error: 0,
    }
  } catch {
    return { valid: 0, warning: 0, excluded: 0, error: 0 }
  }
}

export interface GSCCoreWebVitals {
  lcp: number | null
  fid: number | null
  cls: number | null
  status: 'good' | 'needs_improvement' | 'poor' | 'unknown'
}

export async function getGSCCoreWebVitals(siteUrl: string): Promise<GSCCoreWebVitals> {
  try {
    const apiKey = process.env.PAGESPEED_API_KEY
    const params = new URLSearchParams({
      url: siteUrl,
      strategy: 'mobile',
      category: 'performance',
      ...(apiKey ? { key: apiKey } : {}),
    })
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`)
    if (!res.ok) return { lcp: null, fid: null, cls: null, status: 'unknown' }
    const data = await res.json()
    const metrics = data?.loadingExperience?.metrics ?? {}
    const lcp = metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null
    const fid = metrics.FIRST_INPUT_DELAY_MS?.percentile ?? metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null
    const cls = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
      ? metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : null
    const overall = data?.loadingExperience?.overall_category ?? 'AVERAGE'
    const status = overall === 'FAST' ? 'good' : overall === 'SLOW' ? 'poor' : 'needs_improvement'
    return { lcp, fid, cls, status }
  } catch {
    return { lcp: null, fid: null, cls: null, status: 'unknown' }
  }
}
