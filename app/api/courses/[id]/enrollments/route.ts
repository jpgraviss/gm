import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

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
  // The real course viewer and the portal training page both call this to
  // find the caller's own enrollment by filtering client-side for their
  // email (app/courses/[id]/page.tsx, app/portal/services/sales-training/
  // page.tsx) — requireRole('Team Member') blocked every portal client.
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id } = await params
  const pag = parsePagination(req)
  const db = createServiceClient()

  // AUDIT.md #203 — this used to return every student's enrollment for the
  // course (name/email/progress) to any authenticated caller, relying on
  // the two real consumers to filter client-side for their own email —
  // meaning every other company's students' PII was sent to the browser
  // first and filtered only in JS. Staff (course management, and the
  // enrollmentId-based lookup of a specific student's progress) still get
  // the full roster; a non-staff caller is now scoped server-side to only
  // their own enrollment(s).
  const staff = await isStaffCaller(req)

  let query = db
    .from('course_enrollments')
    .select('*')
    .eq('course_id', id)
  if (!staff) {
    query = query.ilike('student_email', email)
  }
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
  const actor = await getAuthUser(req)

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

  // AUDIT #276 — atomic RPC instead of a read-then-write increment.
  await db.rpc('adjust_course_enrolled_count', { p_id: id, p_delta: 1 })

  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'enrolled_student', module: 'courses', type: 'action', metadata: { courseId: id, enrollmentId: data.id, studentEmail: body.studentEmail } })
  return NextResponse.json(mapEnrollment(data), { status: 201 })
})
