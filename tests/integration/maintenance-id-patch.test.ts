import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #573 — PATCH /api/maintenance/[id] previously accepted `status` as
// any string. Every tab filter in app/maintenance/page.tsx checks exact
// equality against the 5 real MaintenanceStatus values, so a bad value
// silently drops the record out of every tab. Mirrors the RENEWAL_STATUSES
// enum-validation pattern already used in app/api/renewals/[id]/route.ts.

let updateResult: { data: unknown; error: unknown }

const mockDb = {
  from: vi.fn(() => ({
    update: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve(updateResult))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

import { PATCH } from '@/app/api/maintenance/[id]/route'

function patchMaintenance(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(new URL(`http://localhost/api/maintenance/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id }) })
}

describe('PATCH /api/maintenance/[id] — status enum validation (#573)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateResult = { data: { id: 'm-1', status: 'Active', company: 'Acme Co' }, error: null }
  })

  it('rejects an unrecognized status value without writing to the DB', async () => {
    const res = await patchMaintenance('m-1', { status: 'Bogus Status' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/status/i)
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it.each(['Active', 'Onboarding', 'Pending Cancellation', 'Cancelled', 'Past'])(
    'accepts the real status value %s',
    async (status) => {
      updateResult = { data: { id: 'm-1', status, company: 'Acme Co' }, error: null }
      const res = await patchMaintenance('m-1', { status })
      expect(res.status).toBe(200)
    },
  )
})
