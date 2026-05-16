import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const articleId = searchParams.get('id')
  const db = createServiceClient()

  if (articleId) {
    const { data, error } = await db
      .from('knowledge_articles')
      .select('*')
      .eq('id', articleId)
      .eq('status', 'published')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    await db
      .from('knowledge_articles')
      .update({ views: (data.views ?? 0) + 1 })
      .eq('id', articleId)

    return NextResponse.json(data)
  }

  let query = db
    .from('knowledge_articles')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)

  const { data, error } = await query
  if (error) {
    console.error('[portal/help GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
