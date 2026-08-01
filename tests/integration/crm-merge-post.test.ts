import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #626 — both logAudit() calls in this route hardcoded
// userName: 'System' despite requireRole already resolving a real
// authenticated caller earlier in the route — the exact fake-attribution
// bug class #177 fixed across ~62 other call sites, missed here.

function makeTable(table: string) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => {
    if (table === 'crm_contacts') return Promise.resolve({ data: [{ id: 'ct-2', emails: [], phones: [], tags: [] }], error: null })
    return chain
  })
  chain.is = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data: { id: 'ct-1', full_name: 'Primary Contact', emails: [], phones: [], tags: [] }, error: null }))
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.insert = vi.fn(() => Promise.resolve({ error: null }))
  // update()/delete() chains resolve when awaited directly (no further .eq()/.in() needed beyond above)
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve({ error: null }).then(resolve)
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => makeTable(table)),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { POST } from '@/app/api/crm/merge/route'
import { logAudit } from '@/lib/audit'

function merge(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/crm/merge'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/crm/merge — real caller attribution (#626)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs a contact merge under the real authenticated caller, not "System"', async () => {
    const res = await merge({ type: 'contacts', primaryId: 'ct-1', mergeIds: ['ct-2'] })

    expect(res.status).toBe(200)
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'Jamie Rivera', metadata: expect.objectContaining({ type: 'contact_merge' }) }),
    )
  })
})
