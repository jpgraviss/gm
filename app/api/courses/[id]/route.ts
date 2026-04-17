import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('courses').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  return NextResponse.json(mapCourse(data))
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined)        update.title = body.title
  if (body.description !== undefined)  update.description = body.description
  if (body.thumbnailUrl !== undefined) update.thumbnail_url = body.thumbnailUrl
  if (body.modules !== undefined)      update.modules = body.modules
  if (body.status !== undefined)       update.status = body.status
  if (body.price !== undefined)        update.price = body.price
  if (body.accessType !== undefined)   update.access_type = body.accessType
  if (body.tags !== undefined)         update.tags = body.tags

  const { data, error } = await db.from('courses').update(update).eq('id', id).select().single()
  if (error || !data) {
    console.error('[courses PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update course' }, { status: 500 })
  }
  return NextResponse.json(mapCourse(data))
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('courses').delete().eq('id', id)
  if (error) {
    console.error('[courses DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logAudit({ userName: 'system', action: 'deleted_course', module: 'sales_enablement', type: 'warning', metadata: { courseId: id } })
  return NextResponse.json({ deleted: id })
}
