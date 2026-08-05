import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

// The service-entitlement string a portal client's `services` array must
// contain to self-enroll — matches lib/services.ts's catalog name and the
// key the client-facing Services hub gates the Sales Training page on.
const SALES_TRAINING_SERVICE = 'Sales Training'

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
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  // AUDIT #710 — this route was blanket `requireRole('Team Member')`, so the
  // ONLY way a course_enrollments row could ever exist was a staff member
  // enrolling one student at a time through app/courses/page.tsx. A client
  // whose company genuinely has the Sales Training entitlement, but who
  // wasn't individually pre-enrolled course-by-course, saw full interactive
  // course content with no "Mark Complete" button and got a raw
  // 400 "enrollmentId is required" on quiz submission, with no explanation
  // anywhere. Portal clients can now self-enroll, but only:
  //   - in a Published course (no enrolling into a draft),
  //   - for their OWN email (never someone else's), and
  //   - when their portal_clients row actually carries the Sales Training
  //     service entitlement — the same `services` array the client-facing
  //     Services hub gates on (app/api/portal/dashboard/route.ts).
  const staff = await isStaffCaller(req)
  const callerEmail = await getAuthenticatedEmail(req)
  if (!staff && !callerEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let studentName: string
  let studentEmail: string

  if (staff) {
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied
    if (!body.studentName || typeof body.studentName !== 'string') {
      return NextResponse.json({ error: 'studentName is required' }, { status: 400 })
    }
    if (!body.studentEmail || typeof body.studentEmail !== 'string') {
      return NextResponse.json({ error: 'studentEmail is required' }, { status: 400 })
    }
    studentName = body.studentName
    studentEmail = body.studentEmail
  } else {
    const { data: portalClient } = await db
      .from('portal_clients')
      .select('id, contact, email, services, access')
      .ilike('email', callerEmail!)
      .maybeSingle()

    if (!portalClient || portalClient.access === 'Disabled') {
      return NextResponse.json({ error: 'Portal access required' }, { status: 403 })
    }

    const services: string[] = (portalClient.services as string[]) ?? []
    if (!services.includes(SALES_TRAINING_SERVICE)) {
      return NextResponse.json(
        { error: 'Your account does not include Sales Training. Contact your account manager to get access.' },
        { status: 403 },
      )
    }

    const { data: course } = await db.from('courses').select('id, status').eq('id', id).maybeSingle()
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.status !== 'Published') {
      return NextResponse.json({ error: 'This course is not available yet' }, { status: 403 })
    }

    // Never trust a client-supplied identity — always their own.
    studentName = portalClient.contact || callerEmail!
    studentEmail = portalClient.email || callerEmail!
  }

  // Idempotent: re-enrolling (a double-click, or revisiting the course page)
  // returns the existing enrollment rather than creating a duplicate that
  // would split the student's progress across two rows.
  const { data: existing } = await db
    .from('course_enrollments')
    .select('*')
    .eq('course_id', id)
    .ilike('student_email', studentEmail)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(mapEnrollment(existing), { status: 200 })
  }

  const actor = await getAuthUser(req)

  const { data, error } = await db
    .from('course_enrollments')
    .insert({
      id:            `enr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workspace_id:  staff ? (body.workspaceId ?? null) : null,
      course_id:     id,
      student_name:  studentName,
      student_email: studentEmail,
      progress:      staff ? (body.progress ?? {}) : {},
      status:        staff ? (body.status ?? 'Active') : 'Active',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // AUDIT #276 — atomic RPC instead of a read-then-write increment.
  await db.rpc('adjust_course_enrolled_count', { p_id: id, p_delta: 1 })

  logAudit({
    userName: actor?.name || actor?.email || studentEmail,
    action: staff ? 'enrolled_student' : 'self_enrolled_course',
    module: 'courses',
    type: 'action',
    metadata: { courseId: id, enrollmentId: data.id, studentEmail },
  })
  return NextResponse.json(mapEnrollment(data), { status: 201 })
})
