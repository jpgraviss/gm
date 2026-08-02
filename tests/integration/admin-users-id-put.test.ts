import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #696 — the #667 fix (deriving is_admin from role whenever role
// changes, so the two independent columns can't drift regardless of which
// caller changes them) was applied to PUT /api/team-members/[id] and
// POST /api/admin/users but missed this sibling route — same bug class,
// same risk (a demoted Super Admin silently keeping full requireAdmin
// access if a caller ever sent role without a matching isAdmin).

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
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 'u-1', email: 'a@b.com', ...capturedUpdate }, error: null }))
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Actor', email: 'actor@b.com' }),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

import { PUT } from '@/app/api/admin/users/[id]/route'

function putUser(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/admin/users/u-1'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return PUT(req, { params: Promise.resolve({ id: 'u-1' }) })
}

describe('PUT /api/admin/users/[id] — is_admin derivation (#696)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdate = null
  })

  it('sets is_admin true when role changes to Super Admin', async () => {
    await putUser({ role: 'Super Admin' })
    expect(capturedUpdate?.is_admin).toBe(true)
  })

  it('sets is_admin false when role changes to a lower role, even if isAdmin is not sent', async () => {
    await putUser({ role: 'Team Member' })
    expect(capturedUpdate?.is_admin).toBe(false)
  })

  it('ignores a client-supplied isAdmin that disagrees with the role in the same call', async () => {
    await putUser({ role: 'Team Member', isAdmin: true })
    expect(capturedUpdate?.is_admin).toBe(false)
  })

  it('still honors an explicit isAdmin when role is not part of the same update', async () => {
    await putUser({ isAdmin: true })
    expect(capturedUpdate?.is_admin).toBe(true)
  })

  it('does not touch is_admin when neither role nor isAdmin is sent', async () => {
    await putUser({ name: 'New Name' })
    expect(capturedUpdate).not.toHaveProperty('is_admin')
  })
})
