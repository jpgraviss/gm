import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #583 — GET /api/workspace/guided-actions had no role gate at all
// (only checked the caller was authenticated), unlike every comparable
// internal-tooling route (search, notifications, saved-filters,
// custom-field-definitions, monitored-sites), which all require
// requireRole('Team Member').

let requireRoleResult: unknown

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn(() => Promise.resolve(requireRoleResult)),
  getAuthUser: vi.fn(() => Promise.resolve({ name: 'Jamie', email: 'jamie@gravissmarketing.com', userId: 'u-1' })),
}))

vi.mock('@/lib/guided-actions', () => ({
  getGuidedActions: vi.fn(() => Promise.resolve([])),
}))

import { GET } from '@/app/api/workspace/guided-actions/route'
import { requireRole } from '@/lib/rbac'

function getActions() {
  const req = new NextRequest(new URL('http://localhost/api/workspace/guided-actions'))
  return GET(req)
}

describe('GET /api/workspace/guided-actions — requires Team Member role (#583)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a caller requireRole denies', async () => {
    requireRoleResult = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

    const res = await getActions()

    expect(requireRole).toHaveBeenCalledWith(expect.anything(), 'Team Member')
    expect(res.status).toBe(403)
  })

  it('allows a Team Member caller through', async () => {
    requireRoleResult = null

    const res = await getActions()

    expect(res.status).toBe(200)
  })
})
