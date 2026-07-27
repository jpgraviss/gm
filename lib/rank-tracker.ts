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
  portalVisible: boolean
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
    portalVisible:   row.portal_visible ?? true,
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

  const { error: insertError } = await db.from('keyword_rank_history').insert({
    id:                 newId('kwh'),
    workspace_id:       DEFAULT_WORKSPACE_ID,
    tracked_keyword_id: tracked.id,
    position,
    checked_at:         checkedAt,
  })
  if (insertError) {
    console.error('[rank-tracker] failed to insert keyword_rank_history for', tracked.id, insertError)
  }

  if (position == null) {
    const { error: updateError } = await db
      .from('tracked_keywords')
      .update({ last_checked_at: checkedAt })
      .eq('id', tracked.id)
    if (updateError) {
      console.error('[rank-tracker] failed to update last_checked_at for', tracked.id, updateError)
    }
    return null
  }

  const previousPosition = tracked.currentPosition ?? null
  const bestPosition =
    tracked.bestPosition == null || position < tracked.bestPosition
      ? position
      : tracked.bestPosition

  const { error: updateError } = await db
    .from('tracked_keywords')
    .update({
      previous_position: previousPosition,
      current_position:  position,
      best_position:     bestPosition,
      last_checked_at:   checkedAt,
    })
    .eq('id', tracked.id)
  if (updateError) {
    console.error('[rank-tracker] failed to update tracked_keywords for', tracked.id, updateError)
  }

  return position
}

export async function checkAllRanks(batchSize = 25): Promise<{
  checked: number
  updated: number
  failed: number
  total: number
}> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('tracked_keywords')
    .select('*')
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(batchSize)

  if (error) {
    console.error('[rank-tracker] failed to list tracked keywords', error)
    return { checked: 0, updated: 0, failed: 0, total: 0 }
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

  // AUDIT #347 — this previously just echoed back the batch size
  // (data?.length) as `total`, which reads as "total tracked keywords" but
  // was actually always <= batchSize — a manual refresh always looked like
  // it covered everything even when hundreds more keywords existed.
  const { count: total } = await db
    .from('tracked_keywords')
    .select('id', { count: 'exact', head: true })

  return { checked: data?.length ?? 0, updated, failed, total: total ?? data?.length ?? 0 }
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

const FREQUENCY_INTERVAL_MS: Record<string, number> = {
  daily:     24 * 60 * 60 * 1000,
  weekly:    7 * 24 * 60 * 60 * 1000,
  biweekly:  14 * 24 * 60 * 60 * 1000,
  monthly:   30 * 24 * 60 * 60 * 1000,
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildRankingReportHtml(db: any, report: ScheduledReport): Promise<string | null> {
  let query = db
    .from('tracked_keywords')
    .select('*')
    .order('company_name', { ascending: true })
    .order('keyword', { ascending: true })

  const companyId = report.filters?.companyId as string | undefined
  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error || !data?.length) return null

  const keywords = data.map(mapTracked)

  const rows = keywords.map((k: TrackedKeyword) => {
    const change = k.currentPosition != null && k.previousPosition != null ? k.previousPosition - k.currentPosition : null
    const changeLabel = change == null ? '—' : change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${Math.abs(change)}` : '—'
    const changeColor = change == null ? '#9ca3af' : change > 0 ? '#16a34a' : change < 0 ? '#dc2626' : '#9ca3af'
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(k.keyword)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${escapeHtml(k.companyName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${k.currentPosition ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${changeColor};">${changeLabel}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${k.bestPosition ?? '—'}</td>
      </tr>`
  }).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:32px 20px;">
      <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:4px;">${escapeHtml(report.name)}</h2>
      <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">Ranking snapshot as of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;text-align:left;">
            <th style="padding:8px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;">Keyword</th>
            <th style="padding:8px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;">Company</th>
            <th style="padding:8px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;text-align:center;">Position</th>
            <th style="padding:8px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;text-align:center;">Change</th>
            <th style="padding:8px 12px;color:#6b7280;font-size:11px;text-transform:uppercase;text-align:center;">Best</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

/**
 * Send every scheduled ranking report whose cadence (daily/weekly/biweekly/
 * monthly) has elapsed since it was last sent (or since creation, if never
 * sent). Called from the cron endpoint. A report with zero matching tracked
 * keywords is skipped rather than sending an empty email.
 */
export async function sendDueScheduledReports(): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = createServiceClient()
  const { data: rows, error } = await db.from('rank_tracker_reports').select('*')
  if (error || !rows?.length) return { sent: 0, failed: 0, skipped: 0 }

  const { sendEmail } = await import('@/lib/email')
  const now = Date.now()
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    const report = mapReport(row)
    const interval = FREQUENCY_INTERVAL_MS[report.frequency] ?? FREQUENCY_INTERVAL_MS.weekly
    const lastSent = report.lastSentAt ? new Date(report.lastSentAt).getTime() : new Date(report.createdAt).getTime()
    if (now - lastSent < interval) { skipped++; continue }

    const html = await buildRankingReportHtml(db, report)
    if (!html) { skipped++; continue }

    // Atomic claim — matches dispatchScheduledReviewCampaigns' claim
    // pattern (app/api/cron/route.ts): only proceed if last_sent_at still
    // matches the value just read. Without this, two overlapping cron
    // ticks (GitHub Actions pings every 5 min with no execution-time
    // guard) could both see the same report as due and send duplicate
    // ranking emails to real clients.
    let claimQuery = db.from('rank_tracker_reports').update({ last_sent_at: new Date().toISOString() }).eq('id', report.id)
    claimQuery = report.lastSentAt ? claimQuery.eq('last_sent_at', report.lastSentAt) : claimQuery.is('last_sent_at', null)
    const { data: claimed } = await claimQuery.select('id').maybeSingle()
    if (!claimed) { skipped++; continue }

    try {
      const result = await sendEmail({
        to: report.recipients,
        subject: `${report.name} — Ranking Report`,
        html,
      })
      if (!result.success) throw new Error(result.error || 'Failed to send email')

      sent++
    } catch (err) {
      console.error(`[rank-tracker] failed to send scheduled report ${report.id}:`, err)
      failed++
    }
  }

  return { sent, failed, skipped }
}

export { mapTracked, mapHistory, mapCompetitor, mapCompetitorSnapshot, mapReport }
