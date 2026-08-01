import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #650 — this route reimplemented lib/webhook-verify.ts's signature
// check inline and failed OPEN (accepted unauthenticated payloads) when
// RESEND_WEBHOOK_SECRET was unset, in any environment including
// production — unlike its sibling app/api/email/inbound/route.ts, which
// throws in production when the same var is unset (the #1 fix). It now
// shares the real helper and matches that fail-closed behavior.

const verifyResendSignatureMock = vi.fn()
vi.mock('@/lib/webhook-verify', () => ({
  verifyResendSignature: (...args: unknown[]) => verifyResendSignatureMock(...args),
}))

function makeTable() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.update = vi.fn(() => chain)
  chain.rpc = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return chain
}
const mockDb = { from: vi.fn(() => makeTable()), rpc: vi.fn(() => Promise.resolve({ data: null, error: null })) }
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))
vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))

import { POST } from '@/app/api/sequences/webhooks/route'

function postWebhook(body: unknown, headers: Record<string, string> = {}) {
  const req = new NextRequest(new URL('http://localhost/api/sequences/webhooks'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  return POST(req)
}

const ORIGINAL_ENV = process.env.NODE_ENV
const ORIGINAL_SECRET = process.env.RESEND_WEBHOOK_SECRET

describe('POST /api/sequences/webhooks — signature verification (#650)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.stubEnv('NODE_ENV', ORIGINAL_ENV ?? 'test')
    if (ORIGINAL_SECRET === undefined) delete process.env.RESEND_WEBHOOK_SECRET
    else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL_SECRET
  })

  it('fails closed (500, not a silently-accepted 200) when the secret is unset in production', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    vi.stubEnv('NODE_ENV', 'production')
    const res = await postWebhook({ type: 'email.delivered', data: { email_id: 'e1', to: ['a@b.com'] } })
    expect(res.status).toBe(500)
    expect(verifyResendSignatureMock).not.toHaveBeenCalled()
  })

  it('rejects with 401 when the secret is set but the signature does not verify', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
    vi.stubEnv('NODE_ENV', 'production')
    verifyResendSignatureMock.mockReturnValue(false)
    const res = await postWebhook({ type: 'email.delivered', data: { email_id: 'e1', to: ['a@b.com'] } })
    expect(res.status).toBe(401)
    expect(verifyResendSignatureMock).toHaveBeenCalled()
  })

  it('accepts the payload when the secret is set and the signature verifies', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_test'
    vi.stubEnv('NODE_ENV', 'production')
    verifyResendSignatureMock.mockReturnValue(true)
    const res = await postWebhook({ type: 'email.delivered', data: { email_id: 'e1', to: ['a@b.com'] } })
    expect(res.status).toBe(200)
  })

  it('accepts unsigned payloads outside production when the secret is unset (dev-only escape hatch)', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET
    vi.stubEnv('NODE_ENV', 'development')
    const res = await postWebhook({ type: 'email.delivered', data: { email_id: 'e1', to: ['a@b.com'] } })
    expect(res.status).toBe(200)
  })
})
