import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { mapPost } from '@/lib/social-media'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const pag = parsePagination(req)
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const status = searchParams.get('status')

  const db = createServiceClient()
  let query = db
    .from('social_posts')
    .select('*')
  if (company) query = query.eq('company_name', company)
  if (status) query = query.eq('status', status)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    console.error('[social-posts GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapPost), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.companyName || !body.content || !body.platforms?.length) {
    return NextResponse.json(
      { error: 'companyName, content, and platforms are required' },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await db
    .from('social_posts')
    .insert({
      id,
      company_name:    body.companyName,
      content:         body.content,
      platforms:       body.platforms,
      scheduled_at:    body.scheduledAt ?? null,
      hashtags:        body.hashtags ?? [],
      link_url:        body.linkUrl ?? null,
      media_urls:      body.mediaUrls ?? [],
      status:          'draft',
      approval_status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[social-posts POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({
    userName: 'system',
    action: 'created_social_post',
    module: 'social_media',
    type: 'action',
    metadata: { postId: id, company: body.companyName },
  })
  return NextResponse.json(mapPost(data), { status: 201 })
}
