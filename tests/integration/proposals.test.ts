import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_PROPOSAL_ROW = {
  id: 'p-123',
  deal_id: null,
  company: 'Acme Corp',
  status: 'Draft',
  value: 25000,
  service_type: 'SEO',
  assigned_rep: 'Jonathan Graviss',
  items: [{ name: 'SEO Audit', type: 'one-time', amount: 5000 }],
  is_renewal: false,
  internal_only: false,
  created_date: '2026-04-08',
  created_at: '2026-04-08T00:00:00Z',
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({
    selectResult: { data: [MOCK_PROPOSAL_ROW], error: null },
    insertResult: { data: MOCK_PROPOSAL_ROW, error: null },
  }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { GET, POST } from '@/app/api/proposals/route'

describe('GET /api/proposals', () => {
  it('returns mapped proposals', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proposals'))
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].company).toBe('Acme Corp')
    expect(data[0].serviceType).toBe('SEO')
    expect(data[0].value).toBe(25000)
    // Verify snake_case → camelCase mapping
    expect(data[0].assignedRep).toBe('Jonathan Graviss')
    expect(data[0].isRenewal).toBe(false)
  })
})

describe('POST /api/proposals', () => {
  it('creates a proposal with valid data', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proposals'), {
      method: 'POST',
      body: JSON.stringify({
        company: 'Acme Corp',
        value: 25000,
        serviceType: 'SEO',
        assignedRep: 'Jonathan Graviss',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.company).toBe('Acme Corp')
  })

  it('rejects missing company', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proposals'), {
      method: 'POST',
      body: JSON.stringify({ value: 5000 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('company')
  })

  it('rejects value exceeding max', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proposals'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', value: 999_999_999 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid status enum', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proposals'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', status: 'InvalidStatus' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
