import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #582 — GET /api/team-members?include_inactive=true returned
// HR-sensitive suspendedReason/accessSchedule/suspendedUntil for every
// inactive member at the lowest staff tier (Team Member), while mutating
// the same data correctly requires Super Admin.

let adminDeniedResult: unknown

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve)
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(() => Promise.resolve(adminDeniedResult)),
}))

import { GET } from '@/app/api/team-members/route'
import { requireAdmin } from '@/lib/admin-auth'

function getTeamMembers(includeInactive: boolean) {
  const url = includeInactive
    ? 'http://localhost/api/team-members?include_inactive=true'
    : 'http://localhost/api/team-members'
  const req = new NextRequest(new URL(url))
  return GET(req)
}

describe('GET /api/team-members — admin gate on include_inactive (#582)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin when include_inactive=true and rejects a non-admin caller', async () => {
    adminDeniedResult = NextResponseForbidden()

    const res = await getTeamMembers(true)

    expect(requireAdmin).toHaveBeenCalled()
    expect(res.status).toBe(403)
  })

  it('allows include_inactive=true for an admin caller', async () => {
    adminDeniedResult = null

    const res = await getTeamMembers(true)

    expect(res.status).toBe(200)
  })

  it('does not require admin for the plain active-roster request', async () => {
    const res = await getTeamMembers(false)

    expect(requireAdmin).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })
})

function NextResponseForbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403 })
}
