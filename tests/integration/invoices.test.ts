import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #510/#511 — issuedDate/paidDate/companyId were silently dropped
// on every POST /api/invoices call (hardcoded issued_date, no paid_date or
// company_id in the insert at all). Fixed, but left with zero dedicated
// test coverage per #532 — this file closes that gap by asserting on the
// exact payload handed to the Supabase insert, not just the mapped response,
// so a future regression that re-drops one of these fields fails a test
// instead of only ever showing up as a silent data-corruption bug again.
let lastInsertPayload: Record<string, unknown> | null = null
let insertResult: { data: unknown; error: unknown }

function makeChain(result: { data?: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    order: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    limit: () => chain,
    delete: () => chain,
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => ({
    select: () => makeChain({ data: [], error: null }),
    insert: (payload: Record<string, unknown>) => {
      if (table === 'invoices') lastInsertPayload = payload
      return makeChain(insertResult)
    },
    update: () => makeChain({ data: null, error: null }),
    delete: () => makeChain({ error: null }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/portal-auth', () => ({ requirePortalClient: vi.fn().mockResolvedValue(null) }))

import { POST } from '@/app/api/invoices/route'

function postInvoice(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/invoices'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/invoices — issuedDate/paidDate/companyId (AUDIT #510/#511)', () => {
  beforeEach(() => {
    lastInsertPayload = null
    insertResult = { data: null, error: null }
  })

  it('persists a caller-supplied issuedDate instead of always defaulting to today', async () => {
    insertResult = {
      data: { id: 'inv-1', company: 'Acme Co', amount: 500, status: 'Pending', issued_date: '2026-01-15', paid_date: null, company_id: null },
      error: null,
    }
    const res = await postInvoice({ company: 'Acme Co', amount: 500, issuedDate: '2026-01-15' })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(lastInsertPayload?.issued_date).toBe('2026-01-15')
    expect(json.issuedDate).toBe('2026-01-15')
  })

  it('defaults issuedDate to today only when the caller omits it', async () => {
    const today = new Date().toISOString().split('T')[0]
    insertResult = {
      data: { id: 'inv-2', company: 'Acme Co', amount: 500, status: 'Pending', issued_date: today, paid_date: null, company_id: null },
      error: null,
    }
    await postInvoice({ company: 'Acme Co', amount: 500 })

    expect(lastInsertPayload?.issued_date).toBe(today)
  })

  it('persists a caller-supplied paidDate — previously dropped no matter what was sent', async () => {
    insertResult = {
      data: { id: 'inv-3', company: 'Acme Co', amount: 500, status: 'Paid', issued_date: '2026-01-01', paid_date: '2026-01-20', company_id: null },
      error: null,
    }
    const res = await postInvoice({ company: 'Acme Co', amount: 500, status: 'Paid', issuedDate: '2026-01-01', paidDate: '2026-01-20' })
    const json = await res.json()

    expect(lastInsertPayload?.paid_date).toBe('2026-01-20')
    expect(json.paidDate).toBe('2026-01-20')
  })

  it('stores paidDate as null when omitted, rather than silently discarding whatever was sent', async () => {
    insertResult = {
      data: { id: 'inv-4', company: 'Acme Co', amount: 500, status: 'Pending', issued_date: '2026-01-01', paid_date: null, company_id: null },
      error: null,
    }
    await postInvoice({ company: 'Acme Co', amount: 500, issuedDate: '2026-01-01' })

    expect(lastInsertPayload?.paid_date).toBeNull()
  })

  it('persists a caller-supplied companyId — the same field CreateInvoiceModal relies on and the CSV importer (#511) also sends', async () => {
    insertResult = {
      data: { id: 'inv-5', company: 'Acme Co', amount: 500, status: 'Pending', issued_date: '2026-01-01', paid_date: null, company_id: 'company-99' },
      error: null,
    }
    const res = await postInvoice({ company: 'Acme Co', amount: 500, companyId: 'company-99' })
    const json = await res.json()

    expect(lastInsertPayload?.company_id).toBe('company-99')
    expect(json.companyId).toBe('company-99')
  })

  it('stores companyId as null when the caller sends no match — e.g. the CSV importer skipping an ambiguous/unmatched company name', async () => {
    insertResult = {
      data: { id: 'inv-6', company: 'Unmatched Co', amount: 500, status: 'Pending', issued_date: '2026-01-01', paid_date: null, company_id: null },
      error: null,
    }
    await postInvoice({ company: 'Unmatched Co', amount: 500 })

    expect(lastInsertPayload?.company_id).toBeNull()
  })
})
