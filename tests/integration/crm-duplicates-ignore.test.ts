import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #683 — the previous read-then-write on app_settings.dismissed_
// duplicates was replaced with a single atomic dismiss_duplicate() RPC
// call. Verifies the route calls the RPC with the right args instead of
// doing its own select/upsert, and surfaces an RPC error correctly.

let rpcResult: { error: unknown }

const mockDb = {
  rpc: vi.fn(() => Promise.resolve(rpcResult)),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
}))

import { POST } from '@/app/api/crm/duplicates/ignore/route'

function ignoreDuplicate(body: unknown) {
  const req = new NextRequest(new URL('http://localhost/api/crm/duplicates/ignore'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/crm/duplicates/ignore — atomic RPC (#683)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcResult = { error: null }
  })

  it('calls dismiss_duplicate with the type and groupKey, not a select+upsert', async () => {
    const res = await ignoreDuplicate({ type: 'contacts', groupKey: 'john@example.com' })
    expect(res.status).toBe(200)
    expect(mockDb.rpc).toHaveBeenCalledWith('dismiss_duplicate', { p_type: 'contacts', p_group_key: 'john@example.com' })
  })

  it('rejects an invalid type before calling the RPC', async () => {
    const res = await ignoreDuplicate({ type: 'deals', groupKey: 'x' })
    expect(res.status).toBe(400)
    expect(mockDb.rpc).not.toHaveBeenCalled()
  })

  it('surfaces an RPC error instead of silently succeeding', async () => {
    rpcResult = { error: { message: 'function dismiss_duplicate does not exist' } }
    const res = await ignoreDuplicate({ type: 'companies', groupKey: 'g1' })
    expect(res.status).toBe(500)
  })
})
