import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db.from('knowledge_articles').select('*').eq('id', id).single()
  if (error) {
    console.error('[knowledge-base/:id GET]', error)
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  await db.from('knowledge_articles').update({ views: (data.views ?? 0) + 1 }).eq('id', id)

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  // Handle feedback increment separately (doesn't update updated_at)
  if (body.feedback === 'helpful' || body.feedback === 'not_helpful') {
    const col = body.feedback === 'helpful' ? 'helpful_count' : 'not_helpful_count'
    const { data: current } = await db.from('knowledge_articles').select(col).eq('id', id).single()
    const currentVal = (current as Record<string, number> | null)?.[col] ?? 0
    const { error: fbErr } = await db.from('knowledge_articles').update({ [col]: currentVal + 1 }).eq('id', id)
    if (fbErr) {
      console.error('[knowledge-base/:id feedback]', fbErr)
      return NextResponse.json({ error: fbErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) update.title = body.title
  if (body.body !== undefined) update.body = body.body
  if (body.category !== undefined) update.category = body.category
  if (body.tags !== undefined) update.tags = body.tags
  if (body.status !== undefined) update.status = body.status
  if (body.author !== undefined) update.author = body.author

  const { data, error } = await db.from('knowledge_articles').update(update).eq('id', id).select().single()
  if (error) {
    console.error('[knowledge-base/:id PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('knowledge_articles').delete().eq('id', id)
  if (error) {
    console.error('[knowledge-base/:id DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ deleted: id })
}
