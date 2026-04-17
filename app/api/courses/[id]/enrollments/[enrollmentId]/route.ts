import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
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
    completedAt:   row.completed_at ?? undefined,
    certificateId: row.certificate_id ?? undefined,
    status:        row.status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  const { id, enrollmentId } = await params
  const body = await req.json()
  const db = createServiceClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.progress !== undefined)      update.progress = body.progress
  if (body.status !== undefined)        update.status = body.status
  if (body.certificateId !== undefined) update.certificate_id = body.certificateId

  // Mark completed
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
    console.error('[enrollment PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update enrollment' }, { status: 500 })
  }

  if (body.completed === true) {
    logAudit({ userName: 'system', action: 'completed_enrollment', module: 'courses', type: 'success', metadata: { courseId: id, enrollmentId } })
  }

  return NextResponse.json(mapEnrollment(data))
}
