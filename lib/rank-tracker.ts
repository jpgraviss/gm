import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { getGSCSearchAnalytics } from '@/lib/google-search-console'

/**
 * Keyword rank tracker.
 *
 * Uses Google Search Console's search analytics API to pull the average
 * position for a tracked keyword on a given site. GSC has a 2–3 day lag,
 * so when checking we query the last 7 days and take the most recent
 * available data point.
 *
 * Data model:
 *   tracked_keywords    — one row per (site, keyword, country) we watch
 *   keyword_rank_history — append-only history, one row per check
 */

export interface TrackedKeyword {
  id: string
  workspaceId: string
  companyId: string | null
  companyName: string
  siteUrl: string
  keyword: string
  country: string
  currentPosition: number | null
  previousPosition: number | null
  bestPosition: number | null
  lastCheckedAt: string | null
  createdAt: string
}

export interface RankHistoryPoint {
  id: string
  trackedKeywordId: string
  position: number | null
  checkedAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTracked(row: any): TrackedKeyword {
  return {
    id:              row.id,
    workspaceId:     row.workspace_id,
    companyId:       row.company_id ?? null,
    companyName:     row.company_name,
    siteUrl:         row.site_url,
    keyword:         row.keyword,
    country:         row.country ?? 'US',
    currentPosition: row.current_position ?? null,
    previousPosition: row.previous_position ?? null,
    bestPosition:    row.best_position ?? null,
    lastCheckedAt:   row.last_checked_at ?? null,
    createdAt:       row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistory(row: any): RankHistoryPoint {
  return {
    id:               row.id,
    trackedKeywordId: row.tracked_keyword_id,
    position:         row.position ?? null,
    checkedAt:        row.checked_at,
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Query GSC for the most recent position the given site/keyword has
 * appeared at over the past 7 days (to account for GSC's 2–3 day lag).
 * Returns null if the keyword has no data.
 */
async function fetchLatestPosition(
  siteUrl: string,
  keyword: string,
  country: string,
): Promise<number | null> {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

  const filters: Array<{
    dimension: string
    operator: string
    expression: string
  }> = [
    { dimension: 'query', operator: 'equals', expression: keyword.toLowerCase() },
  ]
  if (country) {
    filters.push({ dimension: 'country', operator: 'equals', expression: country.toLowerCase() })
  }

  // We want the most recent date's data, so group by date and pick the last.
  // The Search Analytics API doesn't accept filterGroups via our thin wrapper's
  // typed params, so we call it directly with dimensions=['date','query'] and
  // filter client-side.
  const rows = await getGSCSearchAnalytics({
    siteUrl,
    startDate: fmtDate(start),
    endDate:   fmtDate(end),
    dimensions: ['date', 'query'],
    rowLimit:  5000,
  })

  const target = keyword.toLowerCase()
  const matches = rows.filter(
    (r) => (r.keys?.[1] ?? '').toLowerCase() === target,
  )
  if (matches.length === 0) return null

  // Most recent date first.
  matches.sort((a, b) => (b.keys?.[0] ?? '').localeCompare(a.keys?.[0] ?? ''))
  return matches[0].position ?? null
}

/**
 * Insert a new tracked keyword and immediately trigger an initial rank
 * pull so the row shows a current position right away.
 */
export async function addTrackedKeyword(params: {
  companyName: string
  companyId?: string
  siteUrl: string
  keyword: string
  country?: string
}): Promise<TrackedKeyword> {
  const db = createServiceClient()
  const id = newId('kw')
  const country = (params.country ?? 'US').toUpperCase()

  const { data, error } = await db
    .from('tracked_keywords')
    .insert({
      id,
      workspace_id: DEFAULT_WORKSPACE_ID,
      company_id:   params.companyId ?? null,
      company_name: params.companyName,
      site_url:     params.siteUrl,
      keyword:      params.keyword,
      country,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert tracked keyword: ${error?.message ?? 'unknown error'}`)
  }

  const tracked = mapTracked(data)
  // Best-effort initial pull — don't fail the insert if GSC errors.
  try {
    await checkKeyword(tracked)
    const { data: refreshed } = await db
      .from('tracked_keywords')
      .select('*')
      .eq('id', id)
      .single()
    if (refreshed) return mapTracked(refreshed)
  } catch (err) {
    console.error('[rank-tracker] initial pull failed', err)
  }
  return tracked
}

/**
 * Pull the latest position for one tracked keyword, write a history row,
 * and update the tracked_keywords aggregates.
 */
export async function checkKeyword(tracked: TrackedKeyword): Promise<number | null> {
  const db = createServiceClient()
  const position = await fetchLatestPosition(
    tracked.siteUrl,
    tracked.keyword,
    tracked.country,
  )

  const checkedAt = new Date().toISOString()

  // Always record a history row, even if position is null — it represents
  // "we checked and the keyword wasn't found", which is useful context.
  await db.from('keyword_rank_history').insert({
    id:                 newId('kwh'),
    workspace_id:       DEFAULT_WORKSPACE_ID,
    tracked_keyword_id: tracked.id,
    position,
    checked_at:         checkedAt,
  })

  if (position == null) {
    // Still stamp last_checked_at so we know we tried.
    await db
      .from('tracked_keywords')
      .update({ last_checked_at: checkedAt })
      .eq('id', tracked.id)
    return null
  }

  const previousPosition = tracked.currentPosition ?? null
  const bestPosition =
    tracked.bestPosition == null || position < tracked.bestPosition
      ? position
      : tracked.bestPosition

  await db
    .from('tracked_keywords')
    .update({
      previous_position: previousPosition,
      current_position:  position,
      best_position:     bestPosition,
      last_checked_at:   checkedAt,
    })
    .eq('id', tracked.id)

  return position
}

/**
 * Cron entrypoint — pull fresh positions for every tracked keyword.
 * Swallows per-keyword failures so one broken site doesn't block the job.
 */
export async function checkAllRanks(): Promise<{
  checked: number
  updated: number
  failed: number
}> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('tracked_keywords')
    .select('*')
    .order('last_checked_at', { ascending: true, nullsFirst: true })

  if (error) {
    console.error('[rank-tracker] failed to list tracked keywords', error)
    return { checked: 0, updated: 0, failed: 0 }
  }

  let updated = 0
  let failed = 0
  for (const row of data ?? []) {
    try {
      const pos = await checkKeyword(mapTracked(row))
      if (pos != null) updated += 1
    } catch (err) {
      failed += 1
      console.error('[rank-tracker] check failed for', row.id, err)
    }
  }

  return { checked: data?.length ?? 0, updated, failed }
}

/**
 * Read history rows for a chart. Returns oldest → newest.
 */
export async function getKeywordHistory(
  trackedKeywordId: string,
  days = 90,
): Promise<RankHistoryPoint[]> {
  const db = createServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('keyword_rank_history')
    .select('*')
    .eq('tracked_keyword_id', trackedKeywordId)
    .gte('checked_at', since)
    .order('checked_at', { ascending: true })

  if (error) {
    console.error('[rank-tracker] failed to load history', error)
    return []
  }
  return (data ?? []).map(mapHistory)
}

export { mapTracked, mapHistory }
