import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #572 — DELETE /api/push/subscribe previously deleted a subscription
// by `endpoint` alone, with no ownership check — any authenticated caller
// who knew/guessed another user's push endpoint could unsubscribe them.
// Asserts the fix: the delete is scoped to the caller's own user_id too.

let lastEqCalls: [string, unknown][]
let deleteResult: { error: unknown }

const mockDb = {
  from: vi.fn(() => ({
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => {
      lastEqCalls = []
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn((k: string, v: unknown) => {
        lastEqCalls.push([k, v])
        return chain
      })
      chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(deleteResult).then(resolve, reject)
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ userId: 'user-1', name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

import { DELETE } from '@/app/api/push/subscribe/route'
import { getAuthUser } from '@/lib/rbac'

function deleteSubscription(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/push/subscribe'), {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
  return DELETE(req)
}

describe('DELETE /api/push/subscribe — ownership check (#572)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ userId: 'user-1', name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' } as never)
    deleteResult = { error: null }
  })

  it('scopes the delete to both the endpoint and the caller\'s own user_id', async () => {
    const res = await deleteSubscription({ endpoint: 'https://push.example.com/abc' })

    expect(res.status).toBe(200)
    expect(lastEqCalls).toContainEqual(['endpoint', 'https://push.example.com/abc'])
    expect(lastEqCalls).toContainEqual(['user_id', 'user-1'])
  })

  it('returns 401 when there is no authenticated caller', async () => {
    vi.mocked(getAuthUser).mockResolvedValueOnce(null)

    const res = await deleteSubscription({ endpoint: 'https://push.example.com/abc' })

    expect(res.status).toBe(401)
  })
})
