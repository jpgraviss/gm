import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #604 — POST /api/calendar/import-link accepted a caller-supplied
// userEmail with zero ownership check, unlike its sibling
// calendar/subscriptions route (#101's isOwnerOrAdmin). Any Team Member
// could plant an ICS subscription attributed to a different colleague.

let authUser: { email: string; isAdmin: boolean; role: string } | null
let insertCalls: Record<string, unknown>[]

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.insert = vi.fn((payload: Record<string, unknown>) => {
      insertCalls.push(payload)
      return Promise.resolve({ error: null })
    })
    chain.select = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 'b-1' }, error: null }))
    chain.not = vi.fn(() => chain)
    chain.limit = vi.fn(() => Promise.resolve({ data: [], error: null }))
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn(() => Promise.resolve(authUser)),
}))

vi.mock('@/lib/ssrf-guard', () => ({
  fetchTextSafely: vi.fn(() => Promise.resolve('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')),
}))

import { POST } from '@/app/api/calendar/import-link/route'

function importLink(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/calendar/import-link'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/calendar/import-link — ownership check on userEmail (#604)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertCalls = []
  })

  it('rejects a Team Member importing a calendar attributed to a different colleague', async () => {
    authUser = { email: 'jamie@gravissmarketing.com', isAdmin: false, role: 'Team Member' }

    const res = await importLink({ link: 'https://example.com/feed.ics', userEmail: 'someone-else@gravissmarketing.com' })

    expect(res.status).toBe(403)
    expect(insertCalls).toHaveLength(0)
  })

  it('allows importing a calendar attributed to the caller\'s own email', async () => {
    authUser = { email: 'jamie@gravissmarketing.com', isAdmin: false, role: 'Team Member' }

    const res = await importLink({ link: 'https://example.com/feed.ics', userEmail: 'jamie@gravissmarketing.com' })

    expect(res.status).toBe(200)
  })

  it('allows an admin to import a calendar attributed to any team member', async () => {
    authUser = { email: 'admin@gravissmarketing.com', isAdmin: true, role: 'Team Member' }

    const res = await importLink({ link: 'https://example.com/feed.ics', userEmail: 'someone-else@gravissmarketing.com' })

    expect(res.status).toBe(200)
  })
})
