import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #520/#532 — the Draft-only guard on content edits was read-then-
// write with no `.eq('status', 'Draft')` on the write itself: a concurrent
// request transitioning the same addendum Draft→Sent between the read and
// the write could let a content edit land after the addendum was already
// sent. The fix re-asserts `.eq('status', 'Draft')` on the actual write for
// content edits, turning a silent race into a clean 409. This file asserts
// both the added filter and the 409-on-race behavior, and that a pure
// status-change PATCH keeps its original unconditional write.

let existingStatusResult: { data: { status: string } | null; error: unknown }
let updateSingleResult: { data: unknown; error: unknown }
let updateEqCalls: [string, unknown][]

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'contract_addendums') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.single = vi.fn(() => Promise.resolve(existingStatusResult))
          return chain
        }),
        update: vi.fn(() => {
          updateEqCalls = []
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn((key: string, value: unknown) => {
            updateEqCalls.push([key, value])
            return chain
          })
          chain.select = vi.fn(() => chain)
          chain.single = vi.fn(() => Promise.resolve(updateSingleResult))
          return chain
        }),
      }
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) }
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { PATCH } from '@/app/api/contracts/[id]/addendums/route'

function patchAddendum(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/contracts/contract-1/addendums'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id: 'contract-1' }) })
}

describe('PATCH /api/contracts/[id]/addendums', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-asserts status=Draft on the write itself for a content edit, not just the earlier read', async () => {
    existingStatusResult = { data: { status: 'Draft' }, error: null }
    updateSingleResult = {
      data: { id: 'add-1', contract_id: 'contract-1', title: 'New title', description: 'desc', status: 'Draft', created_at: '2026-01-01T00:00:00Z' },
      error: null,
    }

    const res = await patchAddendum({ addendumId: 'add-1', title: 'New title' })

    expect(res.status).toBe(200)
    expect(updateEqCalls).toContainEqual(['status', 'Draft'])
  })

  it('returns 409, not a silent write, when the addendum was sent between the read and the write', async () => {
    existingStatusResult = { data: { status: 'Draft' }, error: null }
    updateSingleResult = { data: null, error: { code: 'PGRST116', message: 'No rows found' } }

    const res = await patchAddendum({ addendumId: 'add-1', title: 'New title' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/no longer editable/i)
  })

  it('does not add the Draft-only filter to a pure status-change write', async () => {
    updateSingleResult = {
      data: { id: 'add-1', contract_id: 'contract-1', title: 'x', description: 'y', status: 'Sent', created_at: '2026-01-01T00:00:00Z', sent_at: '2026-01-16T00:00:00Z' },
      error: null,
    }

    const res = await patchAddendum({ addendumId: 'add-1', status: 'Sent' })

    expect(res.status).toBe(200)
    expect(updateEqCalls).not.toContainEqual(['status', 'Draft'])
    expect(updateEqCalls).toEqual([['id', 'add-1'], ['contract_id', 'contract-1']])
  })
})
