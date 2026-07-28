import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

// AUDIT.md #491 — real server-side quiz grading. Previously QuizContent in
// app/courses/[id]/page.tsx graded entirely client-side against
// `correctIndex` values shipped verbatim in GET /api/courses(/[id]) (now
// stripped for non-staff callers, see mapCourse in those route files), and
// the general enrollment PATCH accepted any client-supplied `progress`
// object with zero validation that a module was actually passed. This
// endpoint is now the ONLY place a quiz module's real correctIndex values
// are read, the only thing that computes score/pass-fail, and the only way
// a quiz module's completion gets written to an enrollment's progress — the
// enrollment PATCH still accepts client-supplied progress for non-quiz
// modules (video/text have no "correct answer" concept to fake), but can no
// longer be used to forge a quiz pass.

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
}

// Matches the 60%-to-pass threshold QuizContent's handleSubmit already used
// client-side (Math.ceil(questions.length * 0.6)) — kept identical so a
// score that used to say "Passed" still does now that it's computed here.
const PASS_FRACTION = 0.6

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEnrollment(row: any) {
  return {
    id:            row.id,
    workspaceId:   row.workspace_id,
    courseId:      row.course_id,
    studentName:   row.student_name,
    studentEmail:  row.student_email,
    progress:      row.progress ?? {},
    completedAt:   row.completed_at ?? undefined,
    status:        row.status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

export const POST = withErrorHandler('courses/[id]/quiz/[moduleId]/grade POST', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) => {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id, moduleId } = await params

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { enrollmentId, answers } = body as { enrollmentId?: unknown; answers?: unknown }

  // enrollmentId is optional — a caller previewing a quiz without an active
  // enrollment on record (e.g. staff QA-ing a course they're not enrolled
  // in) can still get graded, they just won't have any progress persisted
  // below. When present it must be a real string so the enrollment lookup
  // isn't handed a garbage value.
  if (enrollmentId !== undefined && (typeof enrollmentId !== 'string' || !enrollmentId)) {
    return NextResponse.json({ error: 'enrollmentId must be a non-empty string' }, { status: 400 })
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json(
      { error: 'answers is required and must be an object mapping question index to selected option index' },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  const staff = await isStaffCaller(req)

  // The real answer key lives only in the DB row's raw `modules` column —
  // never through mapCourse, which is what strips correctIndex before
  // anything reaches a student.
  const { data: course, error: courseErr } = await db
    .from('courses')
    .select('modules, status')
    .eq('id', id)
    .single()

  if (courseErr || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  // Same staff-only-Draft gate the sibling GET route enforces (courses/[id]/
  // route.ts) — without it, an unpublished course's quiz answer key would be
  // readable by anyone via this endpoint even though the course itself 404s
  // for non-staff callers.
  if (course.status !== 'Published' && !staff) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: any[] = course.modules ?? []
  const quizModule = modules.find((m) => m?.id === moduleId)
  if (!quizModule || quizModule.type !== 'quiz') {
    return NextResponse.json({ error: 'Quiz module not found' }, { status: 404 })
  }

  let questions: QuizQuestion[] = []
  try {
    const parsed = JSON.parse(quizModule.content ?? '[]')
    if (Array.isArray(parsed)) questions = parsed
  } catch {
    questions = []
  }

  if (questions.length === 0) {
    return NextResponse.json({ error: 'This quiz has no questions to grade' }, { status: 400 })
  }

  // AUDIT.md #512 — the no-enrollmentId "preview" branch was originally
  // meant for staff QA-ing a course they're not enrolled in, but nothing
  // actually enforced that: any authenticated caller could hit it with
  // guessed answers on any quiz (including Draft-course quizzes past the
  // status gate above, if they somehow had the id) and read back every
  // correctIndex in the response — a full answer-key oracle. Preview mode
  // now requires a real staff caller; anyone else must supply a real
  // enrollmentId, which is ownership-checked below.
  if (!enrollmentId && !staff) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let enrollment: any = null
  if (enrollmentId) {
    const { data: found, error: enrollErr } = await db
      .from('course_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .eq('course_id', id)
      .single()

    if (enrollErr || !found) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    // Same ownership rule already enforced in
    // app/api/courses/[id]/enrollments/[enrollmentId]/route.ts (AUDIT.md
    // #100/#123) — staff may grade on behalf of any student, everyone else
    // only their own enrollment. Not touched/weakened, just mirrored here so
    // this endpoint can't be used to forge someone else's progress either.
    if (!staff && found.student_email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    enrollment = found
  }

  const submitted = answers as Record<string, unknown>
  let correct = 0
  const results = questions.map((q, i) => {
    const raw = submitted[String(i)]
    const selected = typeof raw === 'number' ? raw : null
    const isCorrect = selected !== null && selected === q.correctIndex
    if (isCorrect) correct++
    // Safe to return correctIndex here — this is the post-submission review
    // response, not the answer key shipped up front.
    return {
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      selected,
      isCorrect,
    }
  })

  const total = questions.length
  const threshold = Math.ceil(total * PASS_FRACTION)
  const passed = correct >= threshold

  let enrollmentRow = enrollment

  // A passing grade computed right here is the ONLY way a quiz module gets
  // marked complete — replaces the client's onComplete()-on-pass call into
  // markModuleComplete for quiz modules specifically. No enrollment (preview
  // mode, see the enrollmentId comment above) means nothing to persist.
  if (passed && enrollment) {
    const currentProgress = (enrollment.progress ?? {}) as Record<string, unknown>
    if (currentProgress[moduleId] !== true) {
      const newProgress = { ...currentProgress, [moduleId]: true }
      const allComplete = modules.length > 0 && modules.every((m) => newProgress[m.id] === true)

      const update: Record<string, unknown> = {
        progress: newProgress,
        updated_at: new Date().toISOString(),
      }
      if (allComplete) {
        update.completed_at = new Date().toISOString()
        update.status = 'Completed'
      }

      const { data: updated, error: updateErr } = await db
        .from('course_enrollments')
        .update(update)
        .eq('id', enrollmentId)
        .eq('course_id', id)
        .select()
        .single()

      if (updateErr || !updated) {
        throw new Error(updateErr?.message || 'Failed to save quiz progress')
      }
      enrollmentRow = updated

      if (allComplete) {
        // Mirrors the audit entry the enrollment PATCH logs when `completed`
        // is set — same identity-resolution reasoning as that route's
        // comment: `email` (not getAuthUser) correctly identifies either a
        // staff caller or the enrolled student themselves.
        logAudit({ userName: email, action: 'completed_enrollment', module: 'courses', type: 'success', metadata: { courseId: id, enrollmentId } })
      }
    }
  }

  logAudit({
    userName: email,
    action: 'graded_quiz',
    module: 'courses',
    type: passed ? 'success' : 'info',
    metadata: { courseId: id, moduleId, enrollmentId, score: correct, total, passed },
  })

  return NextResponse.json({
    score: correct,
    total,
    threshold,
    passed,
    results,
    enrollment: enrollmentRow ? mapEnrollment(enrollmentRow) : null,
  })
})
