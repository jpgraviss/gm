import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

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

export const GET = withErrorHandler('courses GET', async (req) => {
  // The course catalog is portal-visible ("Sales Training" service page),
  // not staff-only — requireRole('Team Member') 403'd every portal client,
  // so the real client-facing training page always rendered empty. Course
  // metadata isn't company-scoped/sensitive, so any authenticated caller
  // (staff or portal client) is enough; per-student enrollment data is
  // separately scoped in the enrollments routes.
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const pag = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('courses')
    .select('*')
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapCourse), nextCursor)
})

export const POST = withErrorHandler('courses POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

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
      access_type:    body.accessType ?? null,
      tags:           body.tags ?? [],
      enrolled_count: 0,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'created_course', module: 'courses', type: 'action', metadata: { courseId: data.id, title: data.title } })
  return NextResponse.json(mapCourse(data), { status: 201 })
})
