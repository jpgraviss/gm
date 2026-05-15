import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const status = searchParams.get('status')
  const db = createServiceClient()

  let query = db
    .from('knowledge_articles')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) {
    console.error('[knowledge-base GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const id = `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const row = {
    id,
    title: body.title.trim(),
    body: body.body ?? '',
    category: body.category ?? 'Getting Started',
    tags: Array.isArray(body.tags) ? body.tags : [],
    author: body.author ?? null,
    status: body.status ?? 'draft',
  }

  const { data, error } = await db.from('knowledge_articles').insert(row).select().single()
  if (error) {
    console.error('[knowledge-base POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
