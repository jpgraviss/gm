import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { slugifyForm } from '@/lib/forms'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('funnel_pages')
    .select('*')
    .eq('funnel_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[funnel_pages GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    console.error('[funnel_pages POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    console.error('[funnel_pages PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update page' }, { status: 500 })
  }
  return NextResponse.json(data)
}
