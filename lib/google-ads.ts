import { getValidMarketingToken } from '@/lib/google-marketing'

/**
 * Google Ads API wrapper.
 * API docs: https://developers.google.com/google-ads/api/rest/overview
 *
 * Requires a developer token (GOOGLE_ADS_DEVELOPER_TOKEN env var) in addition
 * to the OAuth access token. Uses the v17 REST endpoints.
 */

const ADS_API_BASE = 'https://googleads.googleapis.com/v17'

interface AdsSearchStreamResponse {
  results?: Array<Record<string, unknown>>
  fieldMask?: string
}

/**
 * POST a GAQL query to the searchStream endpoint for a given customer.
 * Returns the flattened list of row objects across all chunks.
 */
async function adsFetch(
  customerId: string,
  query: string,
): Promise<Array<Record<string, unknown>>> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    throw new Error('Developer token missing')
  }

  const auth = await getValidMarketingToken('ads')
  if (!auth) throw new Error('Google Ads not connected')

  const cleanId = customerId.replace(/-/g, '')
  const res = await fetch(
    `${ADS_API_BASE}/customers/${cleanId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'developer-token': developerToken,
        'login-customer-id': cleanId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Ads searchStream failed: ${res.status} ${body}`)
  }

  // searchStream returns an array of response chunks.
  const chunks = (await res.json()) as AdsSearchStreamResponse | AdsSearchStreamResponse[]
  const list = Array.isArray(chunks) ? chunks : [chunks]
  const rows: Array<Record<string, unknown>> = []
  for (const chunk of list) {
    for (const row of chunk.results ?? []) rows.push(row)
  }
  return rows
}

export interface AdsAccount {
  id: string
  name: string
  currencyCode: string
  timeZone: string
  descriptiveName: string
}

/**
 * List all accessible Google Ads customer accounts with descriptive detail.
 * Errored accounts (no access, suspended, etc.) are skipped silently.
 */
export async function listAdsAccounts(): Promise<AdsAccount[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) {
    throw new Error('Developer token missing')
  }

  const auth = await getValidMarketingToken('ads')
  if (!auth) throw new Error('Google Ads not connected')

  // Step 1: list accessible customer resource names.
  const listRes = await fetch(
    `${ADS_API_BASE}/customers:listAccessibleCustomers`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'developer-token': developerToken,
      },
    },
  )

  if (!listRes.ok) {
    const body = await listRes.text()
    throw new Error(`Google Ads listAccessibleCustomers failed: ${listRes.status} ${body}`)
  }

  const { resourceNames } = (await listRes.json()) as { resourceNames?: string[] }
  const ids = (resourceNames ?? []).map((rn) => rn.replace('customers/', ''))

  // Step 2: fetch descriptive detail for each account, skipping failures.
  const accounts: AdsAccount[] = []
  for (const id of ids) {
    try {
      const rows = await adsFetch(
        id,
        'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer',
      )
      const row = rows[0]
      const customer = (row?.customer ?? {}) as {
        id?: string | number
        descriptiveName?: string
        currencyCode?: string
        timeZone?: string
      }
      const descriptiveName = customer.descriptiveName ?? `Customer ${id}`
      accounts.push({
        id,
        name: descriptiveName,
        currencyCode: customer.currencyCode ?? '',
        timeZone: customer.timeZone ?? '',
        descriptiveName,
      })
    } catch (err) {
      console.warn(`[google-ads] skipping account ${id}:`, err instanceof Error ? err.message : err)
    }
  }

  return accounts
}

export interface AdsSummary {
  totalCost: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  roas: number
}

/**
 * Aggregate summary metrics for a customer over the last N days.
 */
export async function getAdsSummary(customerId: string, days = 28): Promise<AdsSummary> {
  const dateRange = dateRangeClause(days)
  const query =
    'SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.ctr, metrics.average_cpc, metrics.conversions_value ' +
    `FROM customer WHERE segments.date ${dateRange}`

  const rows = await adsFetch(customerId, query)

  let totalCostMicros = 0
  let impressions = 0
  let clicks = 0
  let conversions = 0
  let conversionsValue = 0

  for (const row of rows) {
    const metrics = (row.metrics ?? {}) as {
      costMicros?: string | number
      impressions?: string | number
      clicks?: string | number
      conversions?: number
      conversionsValue?: number
    }
    totalCostMicros += Number(metrics.costMicros ?? 0)
    impressions    += Number(metrics.impressions ?? 0)
    clicks         += Number(metrics.clicks ?? 0)
    conversions    += Number(metrics.conversions ?? 0)
    conversionsValue += Number(metrics.conversionsValue ?? 0)
  }

  const totalCost = totalCostMicros / 1_000_000
  const ctr = impressions > 0 ? clicks / impressions : 0
  const cpc = clicks > 0 ? totalCost / clicks : 0
  const roas = totalCost > 0 ? conversionsValue / totalCost : 0

  return {
    totalCost,
    impressions,
    clicks,
    conversions,
    ctr,
    cpc,
    roas,
  }
}

export interface AdsCampaignRow {
  id: string
  name: string
  status: string
  budget: number
  cost: number
  clicks: number
  impressions: number
  conversions: number
}

/**
 * Per-campaign report over the last N days, sorted by spend descending.
 */
export async function getAdsCampaigns(
  customerId: string,
  days = 28,
): Promise<AdsCampaignRow[]> {
  const dateRange = dateRangeClause(days)
  const query =
    'SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, ' +
    'metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions ' +
    `FROM campaign WHERE segments.date ${dateRange}`

  const rows = await adsFetch(customerId, query)

  // Rows are per-day segmented — aggregate by campaign id.
  const byId = new Map<string, AdsCampaignRow>()

  for (const row of rows) {
    const campaign = (row.campaign ?? {}) as {
      id?: string | number
      name?: string
      status?: string
    }
    const budget = (row.campaignBudget ?? {}) as { amountMicros?: string | number }
    const metrics = (row.metrics ?? {}) as {
      costMicros?: string | number
      clicks?: string | number
      impressions?: string | number
      conversions?: number
    }

    const id = String(campaign.id ?? '')
    if (!id) continue

    const existing = byId.get(id) ?? {
      id,
      name: campaign.name ?? `Campaign ${id}`,
      status: campaign.status ?? 'UNKNOWN',
      budget: Number(budget.amountMicros ?? 0) / 1_000_000,
      cost: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
    }

    existing.cost        += Number(metrics.costMicros ?? 0) / 1_000_000
    existing.clicks      += Number(metrics.clicks ?? 0)
    existing.impressions += Number(metrics.impressions ?? 0)
    existing.conversions += Number(metrics.conversions ?? 0)

    byId.set(id, existing)
  }

  return Array.from(byId.values()).sort((a, b) => b.cost - a.cost)
}

/**
 * Format a Date as GAQL's literal date format, YYYY-MM-DD (local calendar
 * day — Google Ads reports are date-only, not timestamped).
 */
function formatGaqlDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Build a GAQL `segments.date BETWEEN 'start' AND 'end'` clause covering
 * exactly the requested number of days, ending yesterday (Google Ads data
 * for "today" is still incomplete/unstable while the day is in progress).
 *
 * GAQL only offers a fixed set of LAST_N_DAYS literals (7/14/30/90/...) —
 * rounding an arbitrary `days` value to the nearest one silently changes the
 * reporting window (e.g. 28 days would round to 30, a ~7% overstatement).
 * Using explicit BETWEEN start/end dates instead makes the query window
 * exactly match `days` for any value, not just the literals GAQL happens to
 * define.
 */
function dateRangeClause(days: number): string {
  const end = new Date()
  end.setDate(end.getDate() - 1) // yesterday — today's data is incomplete
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1)) // inclusive of both endpoints

  return `BETWEEN '${formatGaqlDate(start)}' AND '${formatGaqlDate(end)}'`
}
