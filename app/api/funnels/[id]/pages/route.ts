import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { slugifyForm } from '@/lib/forms'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('funnels/[id]/pages GET', async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('funnel_pages')
    .select('*')
    .eq('funnel_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(String(error))
  }
  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('funnels/[id]/pages POST', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()
  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('funnel_pages')
    .select('sort_order')
    .eq('funnel_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0

  const pageId = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { data, error } = await db
    .from('funnel_pages')
    .insert({
      id: pageId,
      funnel_id: id,
      name: body.name,
      slug: slugifyForm(body.name),
      blocks: body.blocks ?? [],
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) {
    throw new Error(String(error))
  }
  return NextResponse.json(data, { status: 201 })
})

export const PATCH = withErrorHandler('funnels/[id]/pages PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()

  if (!body.pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.slug !== undefined) update.slug = body.slug
  if (body.blocks !== undefined) update.blocks = body.blocks
  if (body.sort_order !== undefined) update.sort_order = body.sort_order
  if (body.views !== undefined) update.views = body.views
  if (body.conversions !== undefined) update.conversions = body.conversions

  const { data, error } = await db
    .from('funnel_pages')
    .update(update)
    .eq('id', body.pageId)
    .eq('funnel_id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(String(error) || 'Failed to update page')
  }
  return NextResponse.json(data)
})
