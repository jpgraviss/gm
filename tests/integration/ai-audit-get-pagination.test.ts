import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #661 — GET /api/ai/audit (list, no `id`) used to hard-cap at
// .limit(50) with no cursor/pagination at all — once more than 50 audits
// had ever been run, the oldest ones became permanently unreachable
// through this endpoint with no indication anything was missing. Now
// routed through the shared cursor-pagination helpers.

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

// 3 rows, newest first — used to exercise the limit=2 / cursor-follow path.
const ALL_AUDITS = [
  { id: 'a-3', website_url: 'https://c.com', company_name: null, audit_type: 'full', status: 'completed', overall_score: 90, overall_grade: 'A', created_at: '2026-01-03T00:00:00Z', completed_at: '2026-01-03T00:05:00Z' },
  { id: 'a-2', website_url: 'https://b.com', company_name: null, audit_type: 'full', status: 'completed', overall_score: 80, overall_grade: 'B', created_at: '2026-01-02T00:00:00Z', completed_at: '2026-01-02T00:05:00Z' },
  { id: 'a-1', website_url: 'https://a.com', company_name: null, audit_type: 'full', status: 'completed', overall_score: 70, overall_grade: 'C', created_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:05:00Z' },
]

function makeTable() {
  let limitN = ALL_AUDITS.length
  let orClause: string | null = null
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn((n: number) => { limitN = n; return chain })
  chain.or = vi.fn((clause: string) => { orClause = clause; return chain })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => {
    let rows = ALL_AUDITS
    if (orClause) {
      // Mimic applyCursor's `.or('created_at.lt.<ts>,and(...)')` — filter
      // to rows strictly older than the cursor's timestamp.
      const tsMatch = orClause.match(/created_at\.lt\.([^,]+)/)
      const cursorTs = tsMatch?.[1]
      if (cursorTs) rows = rows.filter(r => r.created_at < cursorTs)
    }
    return resolve({ data: rows.slice(0, limitN), error: null })
  }
  return chain
}

const mockDb = { from: vi.fn(() => makeTable()) }
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))

import { GET } from '@/app/api/ai/audit/route'

function listAudits(query = '') {
  const req = new NextRequest(new URL(`http://localhost/api/ai/audit${query}`))
  return GET(req)
}

describe('GET /api/ai/audit — cursor pagination (#661)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a bare array (not a hard-capped 50) and no cursor header when everything fits on one page', async () => {
    const res = await listAudits('?limit=100')
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(3)
    expect(res.headers.get('X-Next-Cursor')).toBeNull()
  })

  it('sets X-Next-Cursor and returns only `limit` rows when more remain', async () => {
    const res = await listAudits('?limit=2')
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('a-3')
    expect(body[1].id).toBe('a-2')
    expect(res.headers.get('X-Next-Cursor')).toBeTruthy()
  })

  it('follows the returned cursor to reach rows past the first page', async () => {
    const first = await listAudits('?limit=2')
    const cursor = first.headers.get('X-Next-Cursor')!
    const second = await listAudits(`?limit=2&cursor=${encodeURIComponent(cursor)}`)
    const body = await second.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('a-1')
    expect(second.headers.get('X-Next-Cursor')).toBeNull()
  })
})
