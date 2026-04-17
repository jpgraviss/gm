import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'
import { logAudit } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnrollment(row: any) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    courseId:       row.course_id,
    studentName:   row.student_name,
    studentEmail:  row.student_email,
    progress:      row.progress ?? {},
    completedAt:   row.completed_at ?? null,
    certificateId: row.certificate_id ?? null,
    status:        row.status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('course_enrollments')
    .select('*')
    .eq('course_id', id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('[enrollments GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapEnrollment), nextCursor)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  if (!body.studentName || typeof body.studentName !== 'string') {
    return NextResponse.json({ error: 'studentName is required' }, { status: 400 })
  }
  if (!body.studentEmail || typeof body.studentEmail !== 'string') {
    return NextResponse.json({ error: 'studentEmail is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify course exists
  const { data: course, error: courseErr } = await db.from('courses').select('id, enrolled_count').eq('id', id).single()
  if (courseErr || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

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
    console.error('[enrollments POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Increment enrolled_count on the course
  await db
    .from('courses')
    .update({ enrolled_count: (course.enrolled_count ?? 0) + 1 })
    .eq('id', id)

  logAudit({ userName: 'system', action: 'enrolled_student', module: 'sales_enablement', type: 'action', metadata: { courseId: id, enrollmentId: data.id, studentEmail: body.studentEmail } })
  return NextResponse.json(mapEnrollment(data), { status: 201 })
}
