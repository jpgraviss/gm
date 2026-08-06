import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller, blockIfPreview } from '@/lib/portal-auth'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnrollment(row: any) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    courseId:       row.course_id,
    studentName:   row.student_name,
    studentEmail:  row.student_email,
    progress:      row.progress ?? {},
    completedAt:   row.completed_at ?? undefined,
    status:        row.status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export const GET = withErrorHandler('courses/[id]/enrollments/[enrollmentId] GET', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id, enrollmentId } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('course_enrollments')
    .select('*')
    .eq('id', enrollmentId)
    .eq('course_id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  // Previously had zero auth — any authenticated caller could read (or, in
  // PATCH below, forge completion/certificates on) any other student's
  // enrollment. Staff can see any enrollment; everyone else only their own.
  const staff = await isStaffCaller(req)
  if (!staff && data.student_email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(mapEnrollment(data))
})

export const PATCH = withErrorHandler('courses/[id]/enrollments/[enrollmentId] PATCH', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
  // AUDIT #763 — this is what markModuleComplete on the client course viewer
  // targets, so it's the route that recorded real training progress for a
  // client an admin was only previewing.
  const previewBlocked = blockIfPreview(req)
  if (previewBlocked) return previewBlocked

  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id, enrollmentId } = await params
  const body = await req.json()
  const db = createServiceClient()

  const { data: existing, error: fetchErr } = await db
    .from('course_enrollments')
    .select('student_email, progress')
    .eq('id', enrollmentId)
    .eq('course_id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const staff = await isStaffCaller(req)
  if (!staff && existing.student_email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // AUDIT #525 — this route used to accept any client-supplied `progress`
  // object verbatim and any `completed: true` flag verbatim, with zero
  // validation against the course's actual module list/types. #491 built
  // POST .../quiz/[moduleId]/grade specifically so a quiz module's
  // completion can only be earned by answering questions server-side —
  // this endpoint let anyone bypass that entirely with a direct PATCH.
  const { data: course } = await db.from('courses').select('modules').eq('id', id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courseModules: any[] = course?.modules ?? []
  const quizModuleIds = new Set(courseModules.filter(m => m?.type === 'quiz').map(m => m.id))
  const existingProgress = (existing.progress ?? {}) as Record<string, unknown>

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // The real course viewer's self-service progress tracking
  // (app/courses/[id]/page.tsx markModuleComplete) only ever sends
  // {progress, completed} — status is a staff-only field so a student
  // can't forge their own completion status directly.
  let effectiveProgress = existingProgress
  if (body.progress !== undefined && typeof body.progress === 'object' && body.progress !== null) {
    const rawProgress = body.progress as Record<string, unknown>
    // Quiz modules: always carry forward whatever's already on record
    // (never the client's value, and never dropped just because this
    // particular request didn't re-mention it — the real client always
    // sends the full merged object, but nothing here should assume that).
    const sanitized: Record<string, unknown> = {}
    for (const moduleId of quizModuleIds) {
      if (existingProgress[moduleId] !== undefined) sanitized[moduleId] = existingProgress[moduleId]
    }
    for (const [moduleId, value] of Object.entries(rawProgress)) {
      if (quizModuleIds.has(moduleId)) continue
      sanitized[moduleId] = value
    }
    update.progress = sanitized
    effectiveProgress = sanitized
  }
  if (staff) {
    if (body.status !== undefined) update.status = body.status
  }

  // Only honor `completed: true` when every real module in the course is
  // actually marked complete in the (sanitized) effective progress — a
  // bare `{completed: true}` with no matching progress used to mark the
  // whole course "Completed" instantly with zero verification.
  const allModulesComplete = courseModules.length > 0
    && courseModules.every(m => effectiveProgress[m.id] === true)
  if (body.completed === true && allModulesComplete) {
    update.completed_at = new Date().toISOString()
    update.status = 'Completed'
  }

  const { data, error } = await db
    .from('course_enrollments')
    .update(update)
    .eq('id', enrollmentId)
    .eq('course_id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update enrollment')
  }

  if (body.completed === true) {
    // This handler is reachable by staff OR by the enrolled student
    // completing their own course (real self-service progress tracking,
    // see the comment above) — getAuthUser only resolves staff (team_members)
    // identities and would incorrectly return null for a student, so use
    // the already-verified `email` from getAuthenticatedEmail above, which
    // correctly identifies either caller.
    logAudit({ userName: email, action: 'completed_enrollment', module: 'courses', type: 'success', metadata: { courseId: id, enrollmentId } })
  }

  return NextResponse.json(mapEnrollment(data))
})

export const DELETE = withErrorHandler('courses/[id]/enrollments/[enrollmentId] DELETE', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied
  const actor = await getAuthUser(req)

  const { id, enrollmentId } = await params
  const db = createServiceClient()

  const { error } = await db
    .from('course_enrollments')
    .delete()
    .eq('id', enrollmentId)
    .eq('course_id', id)

  if (error) {
    throw new Error(error.message)
  }

  // AUDIT #276 — atomic RPC instead of a read-then-write decrement.
  await db.rpc('adjust_course_enrolled_count', { p_id: id, p_delta: -1 })

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'unenrolled_student', module: 'courses', type: 'info', metadata: { courseId: id, enrollmentId } })
  return NextResponse.json({ deleted: enrollmentId })
})
