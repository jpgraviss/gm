import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getGSCSearchAnalytics } from '@/lib/google-search-console'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const POST = withErrorHandler('rank-tracker/sync-gsc POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const body = await req.json().catch(() => ({}))
  const siteUrl = body.siteUrl as string | undefined
  const companyName = body.companyName as string | undefined
  const companyId = body.companyId as string | undefined
  const days = Math.min(body.days ?? 28, 90)

  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 })
  }
  if (!companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const rows = await getGSCSearchAnalytics({
    siteUrl,
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ['query'],
    rowLimit: 500,
  })

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, skipped: 0, message: 'No GSC data found' })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('tracked_keywords')
    .select('keyword')
    .eq('site_url', siteUrl)

  const existingSet = new Set(
    (existing ?? []).map((r: { keyword: string }) => r.keyword.toLowerCase()),
  )

  let synced = 0
  let skipped = 0

  const toInsert: Array<Record<string, unknown>> = []
  const historyToInsert: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const row of rows) {
    const query = row.keys?.[0]
    if (!query) continue

    if (existingSet.has(query.toLowerCase())) {
      skipped++
      continue
    }

    const kwId = newId('kw')
    toInsert.push({
      id: kwId,
      workspace_id: DEFAULT_WORKSPACE_ID,
      company_id: companyId ?? null,
      company_name: companyName,
      site_url: siteUrl,
      keyword: query,
      country: 'US',
      current_position: row.position ?? null,
      previous_position: null,
      best_position: row.position ?? null,
      last_checked_at: now,
      tags: ['gsc-sync'],
      target_url: null,
      search_engine: 'google',
      location: null,
      search_volume: null,
      portal_visible: true,
    })

    historyToInsert.push({
      id: newId('kwh'),
      workspace_id: DEFAULT_WORKSPACE_ID,
      tracked_keyword_id: kwId,
      position: row.position ?? null,
      checked_at: now,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
    })

    existingSet.add(query.toLowerCase())
    synced++
  }

  if (toInsert.length > 0) {
    const { error: kwErr } = await db.from('tracked_keywords').insert(toInsert)
    if (kwErr) {
      throw new Error(kwErr?.message || 'Failed to insert keywords')
    }
  }

  if (historyToInsert.length > 0) {
    const { error: histErr } = await db.from('keyword_rank_history').insert(historyToInsert)
    if (histErr) {
      console.error('[sync-gsc] history insert error', histErr)
    }
  }

  await db
    .from('app_settings')
    .upsert(
      {
        id: 'global',
        gsc_last_sync: now,
        updated_at: now,
      },
      { onConflict: 'id' },
    )
    .select()
    .single()

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action: 'gsc_sync',
    module: 'rank-tracker',
    type: 'action',
    metadata: { siteUrl, companyName, synced, skipped },
  })

  return NextResponse.json({ synced, skipped, total: rows.length })
})
