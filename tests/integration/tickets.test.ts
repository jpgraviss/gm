import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

const MOCK_TICKET_ROW = {
  id: 'tkt-123',
  subject: 'Login issue',
  company: 'Acme Corp',
  status: 'Open',
  priority: 'High',
  source: 'Email',
  assigned_to: 'Jonathan Graviss',
  created_date: '2026-04-08',
  tags: ['auth'],
  messages: [{ id: 'm1', author: 'Client', text: 'Cannot log in', date: '2026-04-08', internal: false }],
  contact_name: 'Jane Doe',
  contact_email: 'jane@acme.com',
  service_type: 'Website',
  project_id: null,
  gmail_message_id: null,
  created_at: '2026-04-08T00:00:00Z',
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({
    selectResult: { data: [MOCK_TICKET_ROW], error: null },
    insertResult: { data: MOCK_TICKET_ROW, error: null },
    deleteResult: { error: null },
  }),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { GET, POST } from '@/app/api/tickets/route'

describe('GET /api/tickets', () => {
  it('returns mapped tickets', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tickets'))
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].subject).toBe('Login issue')
    expect(data[0].status).toBe('Open')
    expect(data[0].assignedTo).toBe('Jonathan Graviss')
  })
})

describe('POST /api/tickets', () => {
  it('creates a ticket with valid data', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tickets'), {
      method: 'POST',
      body: JSON.stringify({
        subject: 'Login issue',
        company: 'Acme Corp',
        priority: 'High',
        status: 'Open',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('rejects missing subject', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tickets'), {
      method: 'POST',
      body: JSON.stringify({ company: 'Test' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid priority', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tickets'), {
      method: 'POST',
      body: JSON.stringify({ subject: 'Test', company: 'Test', priority: 'SuperUrgent' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
