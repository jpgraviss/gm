import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #663 — this route had the exact origin-check gaps already fixed
// on the sibling .../chat/route.ts (#616: missing Origin/Referer bypasses
// the check entirely; #633: a malformed Origin falls through to allow)
// but was never updated to match either fix.

let chatbotResult: Record<string, unknown> | null

function makeTable() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve({ data: chatbotResult, error: null }))
  return chain
}

const mockDb = { from: vi.fn(() => makeTable()) }
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))

import { GET } from '@/app/api/chatbots/[id]/public/route'

function fetchPublic(headers: Record<string, string> = {}) {
  const req = new NextRequest(new URL('http://localhost/api/chatbots/bot-1/public'), { headers })
  return GET(req, { params: Promise.resolve({ id: 'bot-1' }) })
}

describe('GET /api/chatbots/[id]/public — origin domain-lock (#663)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatbotResult = { welcome_message: 'Hi!', brand_color: '#000', active: true, name: 'Bot', website_url: 'https://client-site.com' }
  })

  it('rejects a request with no Origin/Referer header at all when website_url is configured', async () => {
    const res = await fetchPublic()
    expect(res.status).toBe(404)
  })

  it('rejects a request from a mismatched Origin', async () => {
    const res = await fetchPublic({ origin: 'https://attacker-site.com' })
    expect(res.status).toBe(404)
  })

  it('allows a request from the configured Origin', async () => {
    const res = await fetchPublic({ origin: 'https://client-site.com' })
    expect(res.status).toBe(200)
  })

  it('rejects a request with a malformed (non-URL-parseable) Origin header', async () => {
    const res = await fetchPublic({ origin: 'not-a-url' })
    expect(res.status).toBe(404)
  })

  it('allows a request with no Origin header when website_url is not configured', async () => {
    chatbotResult = { welcome_message: 'Hi!', brand_color: '#000', active: true, name: 'Bot', website_url: null }
    const res = await fetchPublic()
    expect(res.status).toBe(200)
  })
})
