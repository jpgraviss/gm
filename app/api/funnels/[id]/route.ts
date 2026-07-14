import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('funnels/[id] GET', async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('funnels')
    .select('*, funnel_pages(id, name, slug, blocks, sort_order, views, conversions, created_at)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
  }

  const pages = ((data.funnel_pages ?? []) as Array<Record<string, unknown>>).sort(
    (a, b) => (a.sort_order as number) - (b.sort_order as number)
  )

  return NextResponse.json({
    id: data.id,
    name: data.name,
    slug: data.slug,
    status: data.status,
    workspaceId: data.workspace_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pages,
  })
})

export const PATCH = withErrorHandler('funnels/[id] PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name
  if (body.slug !== undefined) update.slug = body.slug
  if (body.status !== undefined) update.status = body.status

  const { data, error } = await db.from('funnels').update(update).eq('id', id).select().single()
  if (error || !data) {
    throw new Error(String(error) || 'Failed to update funnel')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('funnels/[id] DELETE', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('funnels').delete().eq('id', id)
  if (error) {
    throw new Error(String(error))
  }
  logAudit({ userName: 'system', action: 'deleted_funnel', module: 'funnels', type: 'warning', metadata: { funnelId: id } })
  return NextResponse.json({ deleted: id })
})
