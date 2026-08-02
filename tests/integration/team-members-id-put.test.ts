import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #667 — role and is_admin are two independent columns that two
// different admin surfaces (app/admin/page.tsx, app/settings/page.tsx)
// both PUT to this route. Only the former computed isAdmin itself before
// sending it, so a role change made via the other silently left is_admin
// stale — most dangerously on demotion, where a former Super Admin kept
// full requireAdmin access indefinitely. is_admin must now always be
// derived from role whenever role is present in the request body.

let capturedUpdate: Record<string, unknown> | null = null

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.update = vi.fn((update: Record<string, unknown>) => {
      capturedUpdate = update
      return chain
    })
    chain.eq = vi.fn(() => chain)
    chain.select = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 'tm-1', email: 'a@b.com', ...capturedUpdate }, error: null }))
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Actor', email: 'actor@b.com' }),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

import { PUT } from '@/app/api/team-members/[id]/route'

function putTeamMember(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/team-members/tm-1'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return PUT(req, { params: Promise.resolve({ id: 'tm-1' }) })
}

describe('PUT /api/team-members/[id] — is_admin derivation (#667)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdate = null
  })

  it('sets is_admin true when role changes to Super Admin', async () => {
    await putTeamMember({ role: 'Super Admin' })
    expect(capturedUpdate?.is_admin).toBe(true)
  })

  it('sets is_admin false when role changes to a lower role, even if isAdmin is not sent (demotion via app/settings/page.tsx)', async () => {
    await putTeamMember({ role: 'Team Member' })
    expect(capturedUpdate?.is_admin).toBe(false)
  })

  it('ignores a client-supplied isAdmin that disagrees with the role in the same call', async () => {
    await putTeamMember({ role: 'Team Member', isAdmin: true })
    expect(capturedUpdate?.is_admin).toBe(false)
  })

  it('still honors an explicit isAdmin when role is not part of the same update', async () => {
    await putTeamMember({ isAdmin: true })
    expect(capturedUpdate?.is_admin).toBe(true)
  })

  it('does not touch is_admin when neither role nor isAdmin is sent', async () => {
    await putTeamMember({ name: 'New Name' })
    expect(capturedUpdate).not.toHaveProperty('is_admin')
  })
})
