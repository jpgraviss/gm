import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourse(row: any) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    title:         row.title,
    description:   row.description ?? '',
    thumbnailUrl:  row.thumbnail_url ?? undefined,
    modules:       row.modules ?? [],
    status:        row.status,
    price:         row.price ?? 0,
    accessType:    row.access_type ?? undefined,
    tags:          row.tags ?? [],
    enrolledCount: row.enrolled_count ?? 0,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export const GET = withErrorHandler('courses/[id] GET', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  // Portal-visible catalog item — see matching comment in courses/route.ts.
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('courses').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  return NextResponse.json(mapCourse(data))
})

export const PATCH = withErrorHandler('courses/[id] PATCH', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
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
  if (body.workspaceId !== undefined)  update.workspace_id = body.workspaceId

  const { data, error } = await db.from('courses').update(update).eq('id', id).select().single()
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update course')
  }
  return NextResponse.json(mapCourse(data))
})

export const DELETE = withErrorHandler('courses/[id] DELETE', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('courses').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  logAudit({ userName: 'system', action: 'deleted_course', module: 'courses', type: 'warning', metadata: { courseId: id } })
  return NextResponse.json({ deleted: id })
})
