import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_CONTRACT_ROW = {
  id: 'c-123',
  proposal_id: 'p-456',
  company: 'Test Company',
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
    updateResult: { data: { ...MOCK_CONTRACT_ROW, company: 'Renamed Co', value: 45000, service_type: 'SEO' }, error: null },
  }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/portal-auth', () => ({ requirePortalClient: vi.fn().mockResolvedValue(null), isStaffCaller: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))
vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

import { GET, POST } from '@/app/api/contracts/route'
import { PATCH, DELETE } from '@/app/api/contracts/[id]/route'
import { logAudit } from '@/lib/audit'

describe('GET /api/contracts', () => {
  it('returns mapped contracts', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'))
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].company).toBe('Test Company')
    expect(data[0].billingStructure).toBe('Monthly')
    expect(data[0].proposalId).toBe('p-456')
  })
})

describe('POST /api/contracts', () => {
  it('creates a contract with valid data', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts'), {
      method: 'POST',
      body: JSON.stringify({
        company: 'Test Company',
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

describe('PATCH /api/contracts/[id]', () => {
  it('updates company, value, serviceType, startDate, and duration — previously create-only fields', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-123'), {
      method: 'PATCH',
      body: JSON.stringify({
        company: 'Renamed Co',
        companyId: 'company-99',
        value: 45000,
        serviceType: 'SEO',
        startDate: '2026-06-01',
        duration: 6,
      }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'c-123' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.company).toBe('Renamed Co')
    expect(data.value).toBe(45000)
    expect(data.serviceType).toBe('SEO')
  })

  it('rejects an invalid billing structure on edit, same enum as create', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-123'), {
      method: 'PATCH',
      body: JSON.stringify({ billingStructure: 'BiWeekly' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'c-123' }) })
    expect(res.status).toBe(400)
  })

})

describe('DELETE /api/contracts/[id]', () => {
  // AUDIT #272 — the ~62-site logAudit real-attribution fix (#177) had no
  // regression test asserting the resulting logAudit call's userName; a
  // future refactor could silently reintroduce fake/hardcoded attribution
  // with nothing catching it.
  it('logs the deletion under the real authenticated caller, not a hardcoded name', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-123'), { method: 'DELETE' })

    await DELETE(req, { params: Promise.resolve({ id: 'c-123' }) })

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'Jamie Rivera', action: 'deleted_contract' }),
    )
  })
})
