import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_CONTRACT_ROW = {
  id: 'c-123',
  proposal_id: 'p-456',
  company: 'Acme Corp',
  status: 'Draft',
  value: 30000,
  billing_structure: 'Monthly',
  start_date: '2026-05-01',
  duration: 12,
  renewal_date: '2027-05-01',
  assigned_rep: 'Jonathan Graviss',
  service_type: 'Website',
  client_signed: null,
  internal_signed: null,
  created_at: '2026-04-08T00:00:00Z',
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({
    selectResult: { data: [MOCK_CONTRACT_ROW], error: null },
    insertResult: { data: MOCK_CONTRACT_ROW, error: null },
  }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { GET, POST } from '@/app/api/contracts/route'

describe('GET /api/contracts', () => {
  it('returns mapped contracts', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'))
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].company).toBe('Acme Corp')
    expect(data[0].billingStructure).toBe('Monthly')
    expect(data[0].proposalId).toBe('p-456')
  })
})

describe('POST /api/contracts', () => {
  it('creates a contract with valid data', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'), {
      method: 'POST',
      body: JSON.stringify({
        company: 'Acme Corp',
        value: 30000,
        serviceType: 'Website',
        billingStructure: 'Monthly',
        duration: 12,
        startDate: '2026-05-01',
        proposalId: 'p-456',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('rejects missing company', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'), {
      method: 'POST',
      body: JSON.stringify({ value: 5000 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid billing structure', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', billingStructure: 'BiWeekly' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects duration exceeding max', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', duration: 999 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
