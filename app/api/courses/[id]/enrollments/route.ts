import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

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

export const GET = withErrorHandler('courses/[id]/enrollments GET', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const pag = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('course_enrollments')
    .select('*')
    .eq('course_id', id)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapEnrollment), nextCursor)
})

export const POST = withErrorHandler('courses/[id]/enrollments POST', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const body = await req.json()

  if (!body.studentName || typeof body.studentName !== 'string') {
    return NextResponse.json({ error: 'studentName is required' }, { status: 400 })
  }
  if (!body.studentEmail || typeof body.studentEmail !== 'string') {
    return NextResponse.json({ error: 'studentEmail is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data, error } = await db
    .from('course_enrollments')
    .insert({
      id:            `enr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id:  body.workspaceId ?? null,
      course_id:     id,
      student_name:  body.studentName,
      student_email: body.studentEmail,
      progress:      body.progress ?? {},
      status:        body.status ?? 'Active',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Increment enrolled_count on the course
  const { data: course } = await db.from('courses').select('enrolled_count').eq('id', id).single()
  if (course) {
    await db.from('courses').update({ enrolled_count: (course.enrolled_count ?? 0) + 1 }).eq('id', id)
  }

  logAudit({ userName: 'system', action: 'enrolled_student', module: 'courses', type: 'action', metadata: { courseId: id, enrollmentId: data.id, studentEmail: body.studentEmail } })
  return NextResponse.json(mapEnrollment(data), { status: 201 })
})
