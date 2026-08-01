import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #628 — editing a contact via PUT never updated the denormalized
// deals.contact {id,name,email,phone,title} blob deal cards render
// directly (separate from the real contact_id FK) — #147 nulls it on
// delete and #95 rewrites it on merge, but a normal edit never touched it,
// leaving every linked deal showing stale pre-edit info indefinitely.

let dealsUpdateCalls: { payload: unknown; id: string }[]

function makeTable(table: string) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({
    data: table === 'crm_contacts'
      ? { id: 'ct-1', full_name: 'Jane Updated', emails: ['jane@new.com'], phones: ['555-0100'], title: 'VP Sales', custom_fields: {} }
      : {},
    error: null,
  }))
  chain.eq = vi.fn((_col: string, val: string) => {
    if (table === 'deals') {
      dealsUpdateCalls[dealsUpdateCalls.length - 1].id = val
    }
    return chain
  })
  chain.update = vi.fn((payload: unknown) => {
    if (table === 'deals') dealsUpdateCalls.push({ payload, id: '' })
    return chain
  })
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

vi.mock('@/lib/custom-fields', () => ({
  validateCustomFieldValues: vi.fn().mockResolvedValue(null),
}))

import { PUT } from '@/app/api/crm/contacts/[id]/route'

function putContact(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/crm/contacts/ct-1'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return PUT(req, { params: Promise.resolve({ id: 'ct-1' }) })
}

describe('PUT /api/crm/contacts/[id] — syncs deals.contact blob (#628)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dealsUpdateCalls = []
  })

  it('updates deals.contact for every deal referencing this contact after a successful edit', async () => {
    const res = await putContact({ firstName: 'Jane', lastName: 'Updated', emails: ['jane@new.com'], phones: ['555-0100'], title: 'VP Sales' })

    expect(res.status).toBe(200)
    expect(dealsUpdateCalls).toHaveLength(1)
    expect(dealsUpdateCalls[0].payload).toEqual({
      contact: { id: 'ct-1', name: 'Jane Updated', email: 'jane@new.com', phone: '555-0100', title: 'VP Sales' },
    })
    expect(dealsUpdateCalls[0].id).toBe('ct-1')
  })
})
