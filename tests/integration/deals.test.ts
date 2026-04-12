import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_DEAL_ROW = {
  id: 'deal-123',
  company: 'Trailhead Media',
  stage: 'Proposal Sent',
  value: 7800,
  service_type: 'Website',
  close_date: '2026-06-01',
  assigned_rep: 'Jonathan Graviss',
  probability: 60,
  last_activity: '2026-04-08',
  contact: { id: 'c1', name: 'John Doe', email: 'j@t.com', phone: '', title: 'CEO' },
  notes: ['Initial call completed'],
  created_at: '2026-04-01T00:00:00Z',
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({
    selectResult: { data: [MOCK_DEAL_ROW], error: null },
    insertResult: { data: MOCK_DEAL_ROW, error: null },
  }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { GET, POST } from '@/app/api/deals/route'

describe('GET /api/deals', () => {
  it('returns mapped deals', async () => {
    const req = new NextRequest(new URL('http://localhost/api/deals'))
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].company).toBe('Trailhead Media')
    expect(data[0].serviceType).toBe('Website')
    expect(data[0].assignedRep).toBe('Jonathan Graviss')
  })
})

describe('POST /api/deals', () => {
  it('creates a deal with valid data', async () => {
    const req = new NextRequest(new URL('http://localhost/api/deals'), {
      method: 'POST',
      body: JSON.stringify({
        company: 'Trailhead Media',
        stage: 'Proposal Sent',
        value: 7800,
        serviceType: 'Website',
        assignedRep: 'Jonathan Graviss',
        probability: 60,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('rejects missing company', async () => {
    const req = new NextRequest(new URL('http://localhost/api/deals'), {
      method: 'POST',
      body: JSON.stringify({ value: 1000, stage: 'Lead' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid stage', async () => {
    const req = new NextRequest(new URL('http://localhost/api/deals'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', stage: 'FakeStage' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects probability over 100', async () => {
    const req = new NextRequest(new URL('http://localhost/api/deals'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test', probability: 150 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
