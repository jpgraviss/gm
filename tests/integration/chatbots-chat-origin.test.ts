import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #616 — the website_url domain-lock only ran `if (origin)`, so a
// request with no Origin/Referer at all (trivial for a direct
// scripted/curl caller) bypassed the check entirely, defeating the
// cross-tenant-abuse/AI-spend threat the check exists to defend against.

let chatbotResult: Record<string, unknown> | null

function makeTable() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data: chatbotResult, error: null }))
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }))
  chain.update = vi.fn(() => chain)
  return chain
}

const mockDb = {
  from: vi.fn(() => makeTable()),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/ai-client', () => ({
  chatCompletion: vi.fn(() => Promise.resolve({ text: 'Hello!', source: 'ai' })),
}))

import { POST } from '@/app/api/chatbots/[id]/chat/route'

function chat(message: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(new URL('http://localhost/api/chatbots/bot-1/chat'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
  return POST(req, { params: Promise.resolve({ id: 'bot-1' }) })
}

describe('POST /api/chatbots/[id]/chat — origin domain-lock (#616)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatbotResult = { id: 'bot-1', active: true, website_url: 'https://client-site.com', system_prompt: 'You help.', knowledge: null, settings: {} }
  })

  it('rejects a request with no Origin/Referer header at all when website_url is configured', async () => {
    const res = await chat('Hi there')

    expect(res.status).toBe(403)
  })

  it('rejects a request from a mismatched Origin', async () => {
    const res = await chat('Hi there', { origin: 'https://attacker-site.com' })

    expect(res.status).toBe(403)
  })

  it('allows a request from the configured Origin', async () => {
    const res = await chat('Hi there', { origin: 'https://client-site.com' })

    expect(res.status).toBe(200)
  })

  it('allows a request with no Origin header when website_url is not configured', async () => {
    chatbotResult = { id: 'bot-1', active: true, website_url: null, system_prompt: 'You help.', knowledge: null, settings: {} }

    const res = await chat('Hi there')

    expect(res.status).toBe(200)
  })

  // AUDIT #633 — the malformed-header case fell through and allowed the
  // request instead of rejecting it, same bypass #616 fixed for a missing header.
  it('rejects a request with a malformed (non-URL-parseable) Origin header', async () => {
    const res = await chat('Hi there', { origin: 'not-a-url' })

    expect(res.status).toBe(403)
  })
})
