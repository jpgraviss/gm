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
