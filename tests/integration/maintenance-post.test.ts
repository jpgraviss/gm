import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #580 — POST /api/maintenance (create) accepted `status` as any
// string with no enum validation, the same bug #573 fixed on the sibling
// PATCH route — every tab filter in app/maintenance/page.tsx checks exact
// equality against the 5 real MaintenanceStatus values.

let insertResult: { data: unknown; error: unknown }

const mockDb = {
  from: vi.fn(() => ({
    insert: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve(insertResult))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

import { POST } from '@/app/api/maintenance/route'

function createMaintenance(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/maintenance'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/maintenance — status enum validation (#580)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertResult = { data: { id: 'm-1', company: 'Acme Co', status: 'Active' }, error: null }
  })

  it('rejects an unrecognized status value without inserting', async () => {
    const res = await createMaintenance({ company: 'Acme Co', status: 'Bogus Status' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/status/i)
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('accepts a real status value', async () => {
    const res = await createMaintenance({ company: 'Acme Co', status: 'Onboarding' })
    expect(res.status).toBe(201)
  })

  it('accepts a missing status (defaults server-side)', async () => {
    const res = await createMaintenance({ company: 'Acme Co' })
    expect(res.status).toBe(201)
  })
})
