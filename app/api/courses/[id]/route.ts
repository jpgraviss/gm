import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

const COURSE_STATUSES = new Set(['Draft', 'Published'])

// AUDIT.md #491 — quiz modules store their questions as a JSON-stringified
// `content` field (see QuizContent in app/courses/[id]/page.tsx), each with a
// `correctIndex` answer key. This used to pass straight through to every
// authenticated caller, including enrolled students, who could just read the
// raw API response to see every correct answer before ever taking the quiz.
// Grading is now done server-side (POST .../quiz/[moduleId]/grade, which
// looks up the real correctIndex itself and is the only thing allowed to
// mark a quiz module complete) — a non-staff caller has no legitimate need
// for the answer key at all, so it's stripped here rather than merely hidden
// in the UI.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripQuizAnswers(modules: any[]): any[] {
  if (!Array.isArray(modules)) return modules
  return modules.map((mod) => {
    if (!mod || mod.type !== 'quiz' || typeof mod.content !== 'string') return mod
    try {
      const questions = JSON.parse(mod.content)
      if (!Array.isArray(questions)) return mod
      const sanitized = questions.map((q) => {
        if (q && typeof q === 'object' && !Array.isArray(q)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { correctIndex, ...rest } = q
          return rest
        }
        return q
      })
      return { ...mod, content: JSON.stringify(sanitized) }
    } catch {
      return mod
    }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourse(row: any, opts: { includeAnswers: boolean }) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    title:         row.title,
    description:   row.description ?? '',
    thumbnailUrl:  row.thumbnail_url ?? undefined,
    modules:       opts.includeAnswers ? (row.modules ?? []) : stripQuizAnswers(row.modules ?? []),
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
  // Unpublished course content is staff-only — a portal client resolves
  // null from getAuthUser (not in team_members), matching the same gate in
  // courses/route.ts's list GET. The same staff/non-staff distinction also
  // decides whether quiz answer keys are included (AUDIT.md #491) — staff
  // need `correctIndex` to build/edit quizzes in the course editor, but a
  // student (staff === null here) never should.
  const staffUser = await getAuthUser(req)
  if (data.status !== 'Published' && !staffUser) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  return NextResponse.json(mapCourse(data, { includeAnswers: !!staffUser }))
})

export const PATCH = withErrorHandler('courses/[id] PATCH', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  // AUDIT #595 — accepted body.status verbatim with no enum check.
  if (body.status !== undefined && !COURSE_STATUSES.has(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 })
  }
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
  // requireRole('Leadership') above already gates this to staff.
  return NextResponse.json(mapCourse(data, { includeAnswers: true }))
})

export const DELETE = withErrorHandler('courses/[id] DELETE', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('courses').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'deleted_course', module: 'courses', type: 'warning', metadata: { courseId: id } })
  return NextResponse.json({ deleted: id })
})
