import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { mapTracked } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('tracked-keywords/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('tracked_keywords')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: 'Tracked keyword not found' }, { status: 404 })
  }
  return NextResponse.json(mapTracked(data))
})

export const PATCH = withErrorHandler('tracked-keywords/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = {}
  if (body.companyName !== undefined) update.company_name = body.companyName
  if (body.companyId !== undefined)   update.company_id   = body.companyId
  if (body.siteUrl !== undefined)     update.site_url     = body.siteUrl
  if (body.keyword !== undefined)     update.keyword      = body.keyword
  if (body.country !== undefined)     update.country      = String(body.country).toUpperCase()
  if (body.tags !== undefined)        update.tags         = body.tags
  if (body.targetUrl !== undefined)   update.target_url   = body.targetUrl
  if (body.searchEngine !== undefined) update.search_engine = body.searchEngine
  if (body.location !== undefined)    update.location     = body.location
  if (body.searchVolume !== undefined) update.search_volume = body.searchVolume
  if (body.portalVisible !== undefined) update.portal_visible = body.portalVisible

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await db
    .from('tracked_keywords')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update')
  }
  return NextResponse.json(mapTracked(data))
})

export const DELETE = withErrorHandler('tracked-keywords/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()

  // Cascade: delete snapshots and history rows too
  await db.from('competitor_rank_snapshots').delete().eq('tracked_keyword_id', id)
  await db.from('keyword_rank_history').delete().eq('tracked_keyword_id', id)

  const { error } = await db.from('tracked_keywords').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }

  logAudit({
    userName: actor?.name || actor?.email || 'system',
    action:   'deleted_tracked_keyword',
    module:   'rank-tracker',
    type:     'warning',
    metadata: { id },
  })
  return NextResponse.json({ deleted: id })
})
