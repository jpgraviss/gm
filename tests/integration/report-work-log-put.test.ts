import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #589 — PUT /api/report-work-log trusted a client-submitted
// `updatedBy` verbatim as the client-visible "Prepared by" name on the
// Growth Report email, instead of deriving it from the authenticated
// caller, matching the #438 pattern.

let upsertPayload: Record<string, unknown> | null
let authUser: { name: string } | null

const mockDb = {
  from: vi.fn(() => ({
    upsert: vi.fn((payload: Record<string, unknown>) => {
      upsertPayload = payload
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve({ data: { id: 'rwl-1', ...payload }, error: null }))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn(() => Promise.resolve(authUser)),
}))

import { PUT } from '@/app/api/report-work-log/route'

function putWorkLog(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/report-work-log'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return PUT(req)
}

describe('PUT /api/report-work-log — updatedBy derived server-side (#589)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsertPayload = null
    authUser = { name: 'Jamie Rep' }
  })

  it('ignores a client-submitted updatedBy and uses the authenticated caller\'s name', async () => {
    const res = await putWorkLog({
      companyName: 'Acme Co',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      updatedBy: 'Someone Else Entirely',
    })

    expect(res.status).toBe(200)
    expect(upsertPayload?.updated_by).toBe('Jamie Rep')
  })

  it('sets updated_by to null when there is no authenticated caller', async () => {
    authUser = null

    const res = await putWorkLog({
      companyName: 'Acme Co',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    })

    expect(res.status).toBe(200)
    expect(upsertPayload?.updated_by).toBeNull()
  })
})
