import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #603 — POST /api/calendar/subscriptions {action:'sync-all'} only
// checked ownership when userEmail was present in the body; omitting it
// reached syncAllSubscriptions(undefined), querying every team member's
// subscriptions unscoped — any Team Member could force-sync every
// colleague's private ICS feed on demand.

let queryEqCalls: [string, unknown][]
let authUser: { email: string; isAdmin: boolean; role: string } | null

function makeSubscriptionsChain() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((k: string, v: unknown) => {
    queryEqCalls.push([k, v])
    return chain
  })
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve)
  return chain
}

const mockDb = {
  from: vi.fn(() => makeSubscriptionsChain()),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn(() => Promise.resolve(authUser)),
}))

vi.mock('@/lib/ssrf-guard', () => ({
  fetchTextSafely: vi.fn(),
}))

import { POST } from '@/app/api/calendar/subscriptions/route'

function syncAll(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/calendar/subscriptions'), {
    method: 'POST',
    body: JSON.stringify({ action: 'sync-all', ...body }),
  })
  return POST(req)
}

describe('POST /api/calendar/subscriptions sync-all — scoped to caller (#603)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryEqCalls = []
  })

  it('scopes an omitted userEmail to the non-admin caller\'s own email', async () => {
    authUser = { email: 'jamie@gravissmarketing.com', isAdmin: false, role: 'Team Member' }

    const res = await syncAll({})

    expect(res.status).toBe(200)
    expect(queryEqCalls).toContainEqual(['user_email', 'jamie@gravissmarketing.com'])
  })

  it('leaves the query unscoped (syncs everyone) for an admin caller with no userEmail', async () => {
    authUser = { email: 'admin@gravissmarketing.com', isAdmin: true, role: 'Team Member' }

    const res = await syncAll({})

    expect(res.status).toBe(200)
    expect(queryEqCalls.find(([k]) => k === 'user_email')).toBeUndefined()
  })

  it('leaves the query unscoped for a Leadership caller with no userEmail', async () => {
    authUser = { email: 'lead@gravissmarketing.com', isAdmin: false, role: 'Leadership' }

    const res = await syncAll({})

    expect(res.status).toBe(200)
    expect(queryEqCalls.find(([k]) => k === 'user_email')).toBeUndefined()
  })

  it('still rejects an explicit userEmail for someone else\'s account', async () => {
    authUser = { email: 'jamie@gravissmarketing.com', isAdmin: false, role: 'Team Member' }

    const res = await syncAll({ userEmail: 'someone-else@gravissmarketing.com' })

    expect(res.status).toBe(403)
  })
})
