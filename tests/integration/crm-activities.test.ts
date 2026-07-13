import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_ACTIVITY_ROW = {
  id: 'act-1',
  type: 'call_note',
  title: 'Call Notes logged',
  body: 'Original transcript',
  company_id: 'company-1',
  company_name: 'Test Co',
  contact_id: null,
  contact_name: null,
  deal_id: null,
  user_name: 'Jonathan',
  timestamp: '2026-07-13T12:00:00Z',
  duration: null,
  outcome: null,
  next_step: null,
  pinned: false,
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({
    updateResult: { data: { ...MOCK_ACTIVITY_ROW, title: 'Updated title', body: 'Edited transcript' }, error: null },
  }),
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

import { PATCH } from '@/app/api/crm/activities/[id]/route'

describe('PATCH /api/crm/activities/[id]', () => {
  it('updates title and body, so a logged Call Notes transcript can be corrected after the fact', async () => {
    const req = new NextRequest(new URL('http://localhost/api/crm/activities/act-1'), {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated title', body: 'Edited transcript' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'act-1' }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.title).toBe('Updated title')
    expect(data.body).toBe('Edited transcript')
  })

  it('rejects a request with no fields to update', async () => {
    const req = new NextRequest(new URL('http://localhost/api/crm/activities/act-1'), {
      method: 'PATCH',
      body: JSON.stringify({}),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'act-1' }) })
    expect(res.status).toBe(400)
  })

  it('rejects a body longer than 50,000 characters', async () => {
    const req = new NextRequest(new URL('http://localhost/api/crm/activities/act-1'), {
      method: 'PATCH',
      body: JSON.stringify({ body: 'x'.repeat(50_001) }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ id: 'act-1' }) })
    expect(res.status).toBe(400)
  })
})
