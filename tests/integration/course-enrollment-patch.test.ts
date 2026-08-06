import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #525 — PATCH /api/courses/[id]/enrollments/[enrollmentId] used
// to accept any client-supplied `progress` object (and a bare
// `completed: true`) verbatim, letting anyone forge a quiz module's
// completion without ever hitting the real grading endpoint (#491/#512).

const COURSE_ROW = {
  id: 'crs-1',
  modules: [
    { id: 'mod-quiz-1', title: 'Quiz', type: 'quiz', content: '[]' },
    { id: 'mod-video-1', title: 'Intro', type: 'video', content: 'https://example.com' },
  ],
}

function baseEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr-1',
    course_id: 'crs-1',
    student_email: 'jane@student.com',
    progress: {},
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
                single: () => Promise.resolve({ data: enrollmentRow, error: null }),
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
// Only `isStaffCaller` is stubbed. `blockIfPreview` stays real — it's a pure
// header check, and stubbing it out would make the preview-guard assertion
// below (AUDIT #763) test nothing at all.
vi.mock('@/lib/portal-auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/portal-auth')>()),
  isStaffCaller: vi.fn(),
}))
vi.mock('@/lib/rbac', () => ({ getAuthUser: vi.fn(), requireRole: vi.fn() }))

import { PATCH } from '@/app/api/courses/[id]/enrollments/[enrollmentId]/route'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'

function callRoute(body: unknown, headers?: Record<string, string>) {
  const req = new NextRequest(new URL('http://localhost/api/courses/crs-1/enrollments/enr-1'), {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers,
  })
  return PATCH(req, { params: Promise.resolve({ id: 'crs-1', enrollmentId: 'enr-1' }) })
}

describe('PATCH /api/courses/[id]/enrollments/[enrollmentId]', () => {
  beforeEach(() => {
    enrollmentRow = baseEnrollment()
    updateCalls = []
    vi.mocked(getAuthenticatedEmail).mockResolvedValue('jane@student.com')
    vi.mocked(isStaffCaller).mockResolvedValue(false)
  })

  it('rejects a preview-tagged progress write', async () => {
    // AUDIT #763 — this is markModuleComplete's target. An admin using
    // "View as Client" who scrolled through a module would otherwise record
    // real progress, and a real completion, on that client's training
    // record. Staff, so every other check on this route would pass.
    vi.mocked(getAuthenticatedEmail).mockResolvedValue('staff@gravissmarketing.com')
    vi.mocked(isStaffCaller).mockResolvedValue(true)
    const res = await callRoute(
      { progress: { 'mod-video-1': true } },
      { 'x-client-preview': 'true' },
    )
    expect(res.status).toBe(403)
  })

  it('never adopts a client-supplied true for a quiz module', async () => {
    const res = await callRoute({ progress: { 'mod-quiz-1': true, 'mod-video-1': true } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.progress['mod-quiz-1']).toBeUndefined()
    expect(body.progress['mod-video-1']).toBe(true)
    expect(updateCalls[0].progress['mod-quiz-1']).toBeUndefined()
  })

  it('preserves an already-graded quiz completion instead of dropping it', async () => {
    enrollmentRow = baseEnrollment({ progress: { 'mod-quiz-1': true } })
    const res = await callRoute({ progress: { 'mod-quiz-1': false, 'mod-video-1': true } })
    const body = await res.json()

    expect(body.progress['mod-quiz-1']).toBe(true)
    expect(body.progress['mod-video-1']).toBe(true)
  })

  it('allows legitimate self-service progress on non-quiz modules', async () => {
    const res = await callRoute({ progress: { 'mod-video-1': true } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.progress['mod-video-1']).toBe(true)
  })

  it('rejects a bare completed:true with no matching progress', async () => {
    const res = await callRoute({ completed: true })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).not.toBe('Completed')
    expect(body.completedAt).toBeUndefined()
  })

  it('rejects completed:true when the quiz module was forged, not graded', async () => {
    const res = await callRoute({ progress: { 'mod-quiz-1': true, 'mod-video-1': true }, completed: true })
    const body = await res.json()

    // mod-quiz-1 never actually became true (sanitized away), so not every
    // module is complete — completion must not be granted.
    expect(body.status).not.toBe('Completed')
  })

  it('honors completed:true once every real module is genuinely complete', async () => {
    enrollmentRow = baseEnrollment({ progress: { 'mod-quiz-1': true } })
    const res = await callRoute({ progress: { 'mod-video-1': true }, completed: true })
    const body = await res.json()

    expect(body.status).toBe('Completed')
    expect(body.completedAt).toBeTruthy()
  })
})
