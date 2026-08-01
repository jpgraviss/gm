import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('knowledge-base GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const status = searchParams.get('status')
  const db = createServiceClient()

  // AUDIT #640 — relied entirely on the implicit PostgREST default row cap
  // with no explicit limit; a real one bounds the query instead of leaving
  // it accidentally unbounded. Full cursor pagination (matching
  // courses/brand-kits) is a larger change deferred until KB article
  // volume actually approaches this ceiling.
  let query = db
    .from('knowledge_articles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (category) query = query.eq('category', category)
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch knowledge articles')
  }
  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('knowledge-base POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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
    throw new Error(error?.message || 'Failed to create knowledge article')
  }
  return NextResponse.json(data, { status: 201 })
})
