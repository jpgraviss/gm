import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #491 — server-side quiz grading. The mock DB needs to
// differentiate by table (courses vs course_enrollments) and support
// update(), which tests/helpers/mock-db.ts's shared single-shape chain
// doesn't do, so this test builds its own small per-table mock (same
// pattern as tests/unit/lib/granola.test.ts / automations-engine.test.ts).

const COURSE_ROW = {
  id: 'crs-1',
  modules: [
    {
      id: 'mod-quiz-1',
      title: 'Quiz',
      type: 'quiz',
      content: JSON.stringify([
        { question: '2+2?', options: ['3', '4', '5'], correctIndex: 1 },
        { question: 'Capital of France?', options: ['Berlin', 'Paris', 'Rome'], correctIndex: 1 },
        { question: 'Color of the sky?', options: ['Green', 'Blue', 'Red'], correctIndex: 1 },
      ]),
    },
    { id: 'mod-video-1', title: 'Intro', type: 'video', content: 'https://youtube.com/watch?v=abcdefghijk' },
  ],
}

function baseEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr-1',
    workspace_id: null,
    course_id: 'crs-1',
    student_name: 'Jane Student',
    student_email: 'jane@student.com',
    progress: {},
    completed_at: null,
    status: 'Active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let enrollmentRow: any = baseEnrollment()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let updateCalls: any[] = []

function createDb() {
  return {
    from: (table: string) => {
      if (table === 'courses') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: COURSE_ROW, error: null }),
            }),
          }),
        }
      }
      if (table === 'course_enrollments') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve(
                  enrollmentRow ? { data: enrollmentRow, error: null } : { data: null, error: { message: 'not found' } },
                ),
              }),
            }),
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: (vals: any) => {
            updateCalls.push(vals)
            enrollmentRow = { ...enrollmentRow, ...vals }
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ data: enrollmentRow, error: null }),
                  }),
                }),
              }),
            }
          },
        }
      }
      throw new Error(`Unexpected table in test mock: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => createDb() }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ getAuthenticatedEmail: vi.fn() }))
vi.mock('@/lib/portal-auth', () => ({ isStaffCaller: vi.fn() }))

import { POST } from '@/app/api/courses/[id]/quiz/[moduleId]/grade/route'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

function callRoute(body: unknown) {
  const req = new NextRequest(new URL('http://localhost/api/courses/crs-1/quiz/mod-quiz-1/grade'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req, { params: Promise.resolve({ id: 'crs-1', moduleId: 'mod-quiz-1' }) })
}

describe('POST /api/courses/[id]/quiz/[moduleId]/grade', () => {
  beforeEach(() => {
    enrollmentRow = baseEnrollment()
    updateCalls = []
    vi.mocked(getAuthenticatedEmail).mockResolvedValue('jane@student.com')
    vi.mocked(isStaffCaller).mockResolvedValue(false)
  })

  it('requires authentication', async () => {
    vi.mocked(getAuthenticatedEmail).mockResolvedValue(null)
    const res = await callRoute({ enrollmentId: 'enr-1', answers: {} })
    expect(res.status).toBe(401)
  })

  it('rejects a missing answers payload', async () => {
    const res = await callRoute({ enrollmentId: 'enr-1' })
    expect(res.status).toBe(400)
  })

  it('grades a fully-correct submission and includes correctIndex only in the post-submission review', async () => {
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 1 } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.score).toBe(3)
    expect(body.total).toBe(3)
    expect(body.passed).toBe(true)
    expect(body.results[0].correctIndex).toBe(1)
    expect(body.results[0].isCorrect).toBe(true)
  })

  it('fails a student scoring below 60% and does not mark the module complete', async () => {
    // Only 1/3 correct — below the ceil(3 * 0.6) = 2 threshold.
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 0, '1': 0, '2': 1 } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.score).toBe(1)
    expect(body.passed).toBe(false)
    expect(body.enrollment.progress['mod-quiz-1']).toBeUndefined()
    expect(updateCalls.length).toBe(0)
  })

  it('marks the module complete in enrollment progress on a passing grade', async () => {
    // 2/3 correct — meets the ceil(3 * 0.6) = 2 threshold.
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 0 } })
    const body = await res.json()

    expect(body.passed).toBe(true)
    expect(updateCalls.length).toBe(1)
    expect(updateCalls[0].progress['mod-quiz-1']).toBe(true)
    expect(body.enrollment.progress['mod-quiz-1']).toBe(true)
  })

  it('marks the whole enrollment Completed once every module is done', async () => {
    enrollmentRow = baseEnrollment({ progress: { 'mod-video-1': true } })
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 1 } })
    const body = await res.json()

    expect(body.passed).toBe(true)
    expect(updateCalls[0].status).toBe('Completed')
    expect(body.enrollment.status).toBe('Completed')
    expect(body.enrollment.completedAt).toBeTruthy()
  })

  it('does not re-persist progress on a repeat pass of an already-completed quiz', async () => {
    enrollmentRow = baseEnrollment({ progress: { 'mod-quiz-1': true } })
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 1 } })
    expect(res.status).toBe(200)
    expect(updateCalls.length).toBe(0)
  })

  it('rejects grading another student\'s enrollment', async () => {
    vi.mocked(getAuthenticatedEmail).mockResolvedValue('someone-else@test.com')
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 1 } })
    expect(res.status).toBe(403)
  })

  it('allows staff to grade on behalf of a student', async () => {
    vi.mocked(getAuthenticatedEmail).mockResolvedValue('staff@gravissmarketing.com')
    vi.mocked(isStaffCaller).mockResolvedValue(true)
    const res = await callRoute({ enrollmentId: 'enr-1', answers: { '0': 1, '1': 1, '2': 1 } })
    expect(res.status).toBe(200)
  })

  it('grades without persisting progress when no enrollmentId is supplied (preview mode)', async () => {
    const res = await callRoute({ answers: { '0': 1, '1': 1, '2': 1 } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.passed).toBe(true)
    expect(body.enrollment).toBeNull()
    expect(updateCalls.length).toBe(0)
  })

  it('returns 404 for a non-quiz module id', async () => {
    const req = new NextRequest(new URL('http://localhost/api/courses/crs-1/quiz/mod-video-1/grade'), {
      method: 'POST',
      body: JSON.stringify({ enrollmentId: 'enr-1', answers: { '0': 1 } }),
    })
    const res = await POST(req, { params: Promise.resolve({ id: 'crs-1', moduleId: 'mod-video-1' }) })
    expect(res.status).toBe(404)
  })
})
