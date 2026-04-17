import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourse(row: any) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    title:         row.title,
    description:   row.description ?? '',
    thumbnailUrl:  row.thumbnail_url ?? null,
    modules:       row.modules ?? [],
    status:        row.status,
    price:         row.price ?? 0,
    accessType:    row.access_type ?? 'free',
    tags:          row.tags ?? [],
    enrolledCount: row.enrolled_count ?? 0,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('[courses GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapCourse), nextCursor)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('courses')
    .insert({
      id:             `crs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id:   body.workspaceId ?? null,
      title:          body.title,
      description:    body.description ?? null,
      thumbnail_url:  body.thumbnailUrl ?? null,
      modules:        body.modules ?? [],
      status:         body.status ?? 'Draft',
      price:          body.price ?? 0,
      access_type:    body.accessType ?? 'free',
      tags:           body.tags ?? [],
      enrolled_count: 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[courses POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userName: 'system', action: 'created_course', module: 'sales_enablement', type: 'action', metadata: { courseId: data.id, title: data.title } })
  return NextResponse.json(mapCourse(data), { status: 201 })
}
