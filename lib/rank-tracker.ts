import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { getGSCSearchAnalytics } from '@/lib/google-search-console'

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
  tags: string[]
  targetUrl: string | null
  searchEngine: string
  location: string | null
  searchVolume: number | null
}

export interface RankHistoryPoint {
  id: string
  trackedKeywordId: string
  position: number | null
  checkedAt: string
}

export interface Competitor {
  id: string
  workspaceId: string
  domain: string
  label: string | null
  createdAt: string
}

export interface CompetitorSnapshot {
  id: string
  competitorId: string
  trackedKeywordId: string
  position: number | null
  url: string | null
  checkedAt: string
}

export interface ScheduledReport {
  id: string
  workspaceId: string
  name: string
  frequency: string
  recipients: string[]
  filters: Record<string, unknown>
  lastSentAt: string | null
  createdAt: string
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
    tags:            row.tags ?? [],
    targetUrl:       row.target_url ?? null,
    searchEngine:    row.search_engine ?? 'google',
    location:        row.location ?? null,
    searchVolume:    row.search_volume ?? null,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompetitor(row: any): Competitor {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    domain:      row.domain,
    label:       row.label ?? null,
    createdAt:   row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCompetitorSnapshot(row: any): CompetitorSnapshot {
  return {
    id:               row.id,
    competitorId:     row.competitor_id,
    trackedKeywordId: row.tracked_keyword_id,
    position:         row.position ?? null,
    url:              row.url ?? null,
    checkedAt:        row.checked_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReport(row: any): ScheduledReport {
  return {
    id:          row.id,
    workspaceId: row.workspace_id,
    name:        row.name,
    frequency:   row.frequency ?? 'weekly',
    recipients:  row.recipients ?? [],
    filters:     row.filters ?? {},
    lastSentAt:  row.last_sent_at ?? null,
    createdAt:   row.created_at,
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchLatestPosition(
  siteUrl: string,
  keyword: string,
  country: string,
): Promise<number | null> {
  const end = new Date()
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

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

  matches.sort((a, b) => (b.keys?.[0] ?? '').localeCompare(a.keys?.[0] ?? ''))
  return matches[0].position ?? null
}

export async function addTrackedKeyword(params: {
  companyName: string
  companyId?: string
  siteUrl: string
  keyword: string
  country?: string
  tags?: string[]
  targetUrl?: string
  searchEngine?: string
  location?: string
}): Promise<TrackedKeyword> {
  const db = createServiceClient()
  const id = newId('kw')
  const country = (params.country ?? 'US').toUpperCase()

  const { data, error } = await db
    .from('tracked_keywords')
    .insert({
      id,
      workspace_id:  DEFAULT_WORKSPACE_ID,
      company_id:    params.companyId ?? null,
      company_name:  params.companyName,
      site_url:      params.siteUrl,
      keyword:       params.keyword,
      country,
      tags:          params.tags ?? [],
      target_url:    params.targetUrl ?? null,
      search_engine: params.searchEngine ?? 'google',
      location:      params.location ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to insert tracked keyword: ${error?.message ?? 'unknown error'}`)
  }

  const tracked = mapTracked(data)
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

export async function addTrackedKeywordsBulk(params: {
  companyName: string
  companyId?: string
  siteUrl: string
  keywords: string[]
  country?: string
  tags?: string[]
  targetUrl?: string
  searchEngine?: string
  location?: string
}): Promise<TrackedKeyword[]> {
  const db = createServiceClient()
  const country = (params.country ?? 'US').toUpperCase()

  const rows = params.keywords.map(keyword => ({
    id:            newId('kw'),
    workspace_id:  DEFAULT_WORKSPACE_ID,
    company_id:    params.companyId ?? null,
    company_name:  params.companyName,
    site_url:      params.siteUrl,
    keyword:       keyword.trim(),
    country,
    tags:          params.tags ?? [],
    target_url:    params.targetUrl ?? null,
    search_engine: params.searchEngine ?? 'google',
    location:      params.location ?? null,
  }))

  const { data, error } = await db
    .from('tracked_keywords')
    .insert(rows)
    .select()

  if (error || !data) {
    throw new Error(`Failed to bulk insert: ${error?.message ?? 'unknown error'}`)
  }

  return data.map(mapTracked)
}

export async function checkKeyword(tracked: TrackedKeyword): Promise<number | null> {
  const db = createServiceClient()
  const position = await fetchLatestPosition(
    tracked.siteUrl,
    tracked.keyword,
    tracked.country,
  )

  const checkedAt = new Date().toISOString()

  await db.from('keyword_rank_history').insert({
    id:                 newId('kwh'),
    workspace_id:       DEFAULT_WORKSPACE_ID,
    tracked_keyword_id: tracked.id,
    position,
    checked_at:         checkedAt,
  })

  if (position == null) {
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

export async function getCompetitors(): Promise<Competitor[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('rank_tracker_competitors')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[rank-tracker] failed to load competitors', error)
    return []
  }
  return (data ?? []).map(mapCompetitor)
}

export async function addCompetitor(domain: string, label?: string): Promise<Competitor> {
  const db = createServiceClient()
  const id = newId('rtc')
  const { data, error } = await db
    .from('rank_tracker_competitors')
    .insert({
      id,
      workspace_id: DEFAULT_WORKSPACE_ID,
      domain: domain.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      label: label ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to add competitor: ${error?.message ?? 'unknown'}`)
  }
  return mapCompetitor(data)
}

export async function deleteCompetitor(id: string): Promise<void> {
  const db = createServiceClient()
  await db.from('competitor_rank_snapshots').delete().eq('competitor_id', id)
  await db.from('rank_tracker_competitors').delete().eq('id', id)
}

export async function getCompetitorSnapshots(keywordId: string): Promise<CompetitorSnapshot[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('competitor_rank_snapshots')
    .select('*')
    .eq('tracked_keyword_id', keywordId)
    .order('checked_at', { ascending: false })
    .limit(200)

  if (error) return []
  return (data ?? []).map(mapCompetitorSnapshot)
}

export async function getScheduledReports(): Promise<ScheduledReport[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('rank_tracker_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []).map(mapReport)
}

export async function createScheduledReport(params: {
  name: string
  frequency: string
  recipients: string[]
  filters?: Record<string, unknown>
}): Promise<ScheduledReport> {
  const db = createServiceClient()
  const id = newId('rtr')
  const { data, error } = await db
    .from('rank_tracker_reports')
    .insert({
      id,
      workspace_id: DEFAULT_WORKSPACE_ID,
      name: params.name,
      frequency: params.frequency,
      recipients: params.recipients,
      filters: params.filters ?? {},
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to create report: ${error?.message ?? 'unknown'}`)
  }
  return mapReport(data)
}

export async function deleteScheduledReport(id: string): Promise<void> {
  const db = createServiceClient()
  await db.from('rank_tracker_reports').delete().eq('id', id)
}

export { mapTracked, mapHistory, mapCompetitor, mapCompetitorSnapshot, mapReport }
