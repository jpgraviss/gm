import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #615 — POST /api/sequences/[id]/test-send instantiated a raw
// `new Resend()` and never checked the returned {error}, unconditionally
// reporting success even on a real send failure. Also never replaced
// {{sender_name}}/{{sender_email}} merge tokens unlike the real send path.

let seqResult: { data: unknown; error: unknown }
let sendEmailResult: { success: boolean; error?: string; id?: string }
let sendEmailCalls: Record<string, unknown>[]

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve(seqResult))
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn((opts: Record<string, unknown>) => {
    sendEmailCalls.push(opts)
    return Promise.resolve(sendEmailResult)
  }),
}))

import { POST } from '@/app/api/sequences/[id]/test-send/route'

function testSend(email: string) {
  const req = new NextRequest(new URL('http://localhost/api/sequences/seq-1/test-send'), {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  return POST(req, { params: Promise.resolve({ id: 'seq-1' }) })
}

describe('POST /api/sequences/[id]/test-send — real send-result checking (#615)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendEmailCalls = []
    seqResult = {
      data: {
        id: 'seq-1', name: 'Welcome Sequence',
        steps: [{ type: 'email', subject: 'Hi {{sender_name}}', body: 'Reach us at {{sender_email}}' }],
        send_via: 'resend', from_name: 'Jamie Rep', from_email: 'jamie@gravissmarketing.com',
      },
      error: null,
    }
  })

  it('returns an error when the real send fails, instead of always reporting success', async () => {
    sendEmailResult = { success: false, error: 'Resend: domain not verified' }

    const res = await testSend('client@example.com')
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.error).toMatch(/domain not verified/)
  })

  it('reports success only when the send actually succeeds', async () => {
    sendEmailResult = { success: true, id: 'msg-1' }

    const res = await testSend('client@example.com')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('replaces sender_name/sender_email merge tokens instead of leaving literal syntax', async () => {
    sendEmailResult = { success: true, id: 'msg-1' }

    await testSend('client@example.com')

    expect(sendEmailCalls).toHaveLength(1)
    const call = sendEmailCalls[0]
    expect(call.subject).toContain('Jamie Rep')
    expect(call.subject).not.toContain('{{sender_name}}')
    expect(call.html).toContain('jamie@gravissmarketing.com')
    expect(call.html).not.toContain('{{sender_email}}')
  })
})
