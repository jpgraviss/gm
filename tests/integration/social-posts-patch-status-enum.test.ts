import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #594 — PATCH /api/social-posts/[id] accepted arbitrary status/
// approvalStatus values with no enum validation, unlike POST's
// CREATABLE_STATUSES restriction.

let postResult: Record<string, unknown> | null

function makeChain() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data: postResult, error: postResult ? null : { message: 'not found' } }))
  chain.update = vi.fn(() => chain)
  return chain
}

const mockDb = {
  from: vi.fn(() => makeChain()),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn(() => Promise.resolve({ name: 'Jamie', email: 'jamie@gravissmarketing.com' })),
  requireRole: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/portal-auth', () => ({
  requirePortalClient: vi.fn().mockResolvedValue(null),
  isStaffCaller: vi.fn().mockResolvedValue(true),
  blockIfPreview: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { PATCH } from '@/app/api/social-posts/[id]/route'

function patchPost(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/social-posts/post-1'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id: 'post-1' }) })
}

describe('PATCH /api/social-posts/[id] — status enum validation (#594)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postResult = { id: 'post-1', company_name: null, company_id: null, status: 'draft', scheduled_at: null }
  })

  it('rejects an invalid status value', async () => {
    const res = await patchPost({ status: 'not-a-real-status' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/status/i)
  })

  it('rejects an invalid approvalStatus value', async () => {
    const res = await patchPost({ approvalStatus: 'maybe' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/approvalStatus/i)
  })

  it('accepts a real status value', async () => {
    const res = await patchPost({ status: 'approved' })

    expect(res.status).not.toBe(400)
  })
})
