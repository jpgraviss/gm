import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #599 — bulk-delete of contacts didn't clear the denormalized
// deals.contact blob the way single-contact DELETE /api/crm/contacts/[id]
// does (#147) — deals.contact_id is ON DELETE SET NULL, but the separate
// {id,name,email,phone,title} blob the deal card renders directly is a
// different column, untouched by the FK.

let dealsUpdateCalls: { payload: unknown; ids: string[] }[]
let deleteCalls: { table: string; ids: string[] }[]

function makeTable(table: string) {
  const chain: Record<string, unknown> = {}
  chain.update = vi.fn((payload: unknown) => {
    const updateChain: Record<string, unknown> = {}
    updateChain.in = vi.fn((_col: string, ids: string[]) => {
      dealsUpdateCalls.push({ payload, ids })
      return Promise.resolve({ error: null })
    })
    return updateChain
  })
  chain.delete = vi.fn(() => {
    const deleteChain: Record<string, unknown> = {}
    deleteChain.in = vi.fn((_col: string, ids: string[]) => {
      deleteCalls.push({ table, ids })
      return Promise.resolve({ error: null, count: ids.length })
    })
    return deleteChain
  })
  chain.insert = vi.fn(() => Promise.resolve({ error: null }))
  chain.select = vi.fn(() => chain)
  chain.in = vi.fn(() => Promise.resolve({ data: [], error: null }))
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => makeTable(table)),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/crm-cascade', () => ({
  getCompanyRelatedCounts: vi.fn(),
  hasBlockingRelatedRecords: vi.fn(),
  describeRelatedCounts: vi.fn(),
  deleteCompanyActivities: vi.fn(),
}))

import { POST } from '@/app/api/crm/bulk-delete/route'

function bulkDelete(type: string, ids: string[]) {
  const req = new NextRequest(new URL('http://localhost/api/crm/bulk-delete'), {
    method: 'POST',
    body: JSON.stringify({ type, ids }),
  })
  return POST(req)
}

describe('POST /api/crm/bulk-delete — contacts nulls deals.contact blob (#599)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dealsUpdateCalls = []
    deleteCalls = []
  })

  it('nulls deals.contact for every bulk-deleted contact id before deleting the contacts', async () => {
    const res = await bulkDelete('contacts', ['ct-1', 'ct-2'])

    expect(res.status).toBe(200)
    expect(dealsUpdateCalls).toHaveLength(1)
    expect(dealsUpdateCalls[0].payload).toEqual({ contact: null })
    expect(dealsUpdateCalls[0].ids).toEqual(['ct-1', 'ct-2'])
    expect(deleteCalls.find(c => c.table === 'crm_contacts')).toBeDefined()
  })

  it('does not touch deals.contact for a non-contacts bulk delete', async () => {
    const res = await bulkDelete('tickets', ['tkt-1'])

    expect(res.status).toBe(200)
    expect(dealsUpdateCalls).toHaveLength(0)
  })
})
