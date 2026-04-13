import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { mapTracked } from '@/lib/rank-tracker'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data, error } = await db
    .from('tracked_keywords')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    console.error('[tracked-keywords PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update' }, { status: 500 })
  }
  return NextResponse.json(mapTracked(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()

  // Cascade: delete history rows too
  await db.from('keyword_rank_history').delete().eq('tracked_keyword_id', id)

  const { error } = await db.from('tracked_keywords').delete().eq('id', id)
  if (error) {
    console.error('[tracked-keywords DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({
    userName: 'system',
    action:   'deleted_tracked_keyword',
    module:   'rank-tracker',
    type:     'warning',
    metadata: { id },
  })
  return NextResponse.json({ deleted: id })
}
