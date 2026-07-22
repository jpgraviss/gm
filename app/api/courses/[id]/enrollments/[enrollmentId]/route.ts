import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'
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
    certificateId: row.certificate_id ?? undefined,
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
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id, enrollmentId } = await params
  const body = await req.json()
  const db = createServiceClient()

  const { data: existing, error: fetchErr } = await db
    .from('course_enrollments')
    .select('student_email')
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

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // The real course viewer's self-service progress tracking
  // (app/courses/[id]/page.tsx markModuleComplete) only ever sends
  // {progress, completed} — status/certificateId are staff-only fields so
  // a student can't forge their own completion certificate directly.
  if (body.progress !== undefined) update.progress = body.progress
  if (staff) {
    if (body.status !== undefined)        update.status = body.status
    if (body.certificateId !== undefined) update.certificate_id = body.certificateId
  }

  if (body.completed === true) {
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
