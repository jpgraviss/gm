import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
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
  _req,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
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

  return NextResponse.json(mapEnrollment(data))
})

export const PATCH = withErrorHandler('courses/[id]/enrollments/[enrollmentId] PATCH', async (
  req,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
  const { id, enrollmentId } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.progress !== undefined)      update.progress = body.progress
  if (body.status !== undefined)        update.status = body.status
  if (body.certificateId !== undefined) update.certificate_id = body.certificateId

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
    logAudit({ userName: 'system', action: 'completed_enrollment', module: 'courses', type: 'success', metadata: { courseId: id, enrollmentId } })
  }

  return NextResponse.json(mapEnrollment(data))
})

export const DELETE = withErrorHandler('courses/[id]/enrollments/[enrollmentId] DELETE', async (
  req,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

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

  const { data: course } = await db
    .from('courses')
    .select('enrolled_count')
    .eq('id', id)
    .single()

  if (course && course.enrolled_count > 0) {
    await db
      .from('courses')
      .update({ enrolled_count: course.enrolled_count - 1 })
      .eq('id', id)
  }

  logAudit({ userName: 'system', action: 'unenrolled_student', module: 'courses', type: 'info', metadata: { courseId: id, enrollmentId } })
  return NextResponse.json({ deleted: enrollmentId })
})
