import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #579 — POST /api/push/subscribe's upsert conflict target is
// `endpoint` alone; without an ownership check on conflict, any
// authenticated user who subscribed with an endpoint colliding with
// someone else's existing row would silently hijack it away from its real
// owner. Mirrors the #572 fix already applied to DELETE.

let existingResult: { data: { user_id: string } | null }
let upsertPayload: Record<string, unknown> | null
let upsertCalled: boolean

const mockDb = {
  from: vi.fn(() => ({
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => Promise.resolve(existingResult))
      return chain
    }),
    upsert: vi.fn((payload: Record<string, unknown>) => {
      upsertCalled = true
      upsertPayload = payload
      return Promise.resolve({ error: null })
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ userId: 'user-1', name: 'Jamie', email: 'jamie@gravissmarketing.com' }),
}))

import { POST } from '@/app/api/push/subscribe/route'

function subscribe(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/push/subscribe'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/push/subscribe — ownership check on upsert (#579)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsertPayload = null
    upsertCalled = false
  })

  it('rejects subscribing to an endpoint already owned by a different user', async () => {
    existingResult = { data: { user_id: 'other-user' } }

    const res = await subscribe({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'k', auth: 'a' } })

    expect(res.status).toBe(409)
    expect(upsertCalled).toBe(false)
  })

  it('allows re-subscribing to an endpoint already owned by the same user', async () => {
    existingResult = { data: { user_id: 'user-1' } }

    const res = await subscribe({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'k', auth: 'a' } })

    expect(res.status).toBe(201)
    expect(upsertPayload).toEqual(expect.objectContaining({ user_id: 'user-1' }))
  })

  it('allows subscribing to a brand-new endpoint', async () => {
    existingResult = { data: null }

    const res = await subscribe({ endpoint: 'https://push.example.com/new', keys: { p256dh: 'k', auth: 'a' } })

    expect(res.status).toBe(201)
    expect(upsertCalled).toBe(true)
  })
})
