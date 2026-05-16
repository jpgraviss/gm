import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = body.name
  if (body.slug !== undefined) update.slug = body.slug
  if (body.status !== undefined) update.status = body.status

  const { data, error } = await db.from('funnels').update(update).eq('id', id).select().single()
  if (error || !data) {
    console.error('[funnels PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update funnel' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('funnels').delete().eq('id', id)
  if (error) {
    console.error('[funnels DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_funnel', module: 'funnels', type: 'warning', metadata: { funnelId: id } })
  return NextResponse.json({ deleted: id })
}
