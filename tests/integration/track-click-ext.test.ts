import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { signToken } from '@/lib/signed-token'

// AUDIT #591 — the browser extension's click-tracking redirect previously
// decoded an unsigned base64url {trackedEmailId, url} payload built
// client-side, with no signature check and no redirect-scheme validation —
// an open redirect off the trusted domain, plus a way to forge fake
// "clicked" activity onto any guessed trackedEmailId. Asserts the fix
// matches the sibling broadcast click route (#326): reject an unsigned/
// tampered token, reject a non-http(s) scheme, and only record a click +
// redirect for a token this server actually signed with a safe URL.

let trackedResult: { data: Record<string, unknown> | null }
let insertedClick: Record<string, unknown> | null
let rpcCalls: unknown[]

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'tracked_emails') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.maybeSingle = vi.fn(() => Promise.resolve(trackedResult))
          return chain
        }),
      }
    }
    if (table === 'tracked_email_clicks') {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedClick = payload
          return Promise.resolve({ error: null })
        }),
      }
    }
    return { select: vi.fn() }
  }),
  rpc: vi.fn((...args: unknown[]) => { rpcCalls.push(args); return Promise.resolve({ error: null }) }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/tracked-emails', () => ({
  mirrorTrackedEmailActivity: vi.fn(),
}))

import { GET } from '@/app/api/track/click/ext/[token]/route'

function clickRequest(token: string) {
  const req = new NextRequest(new URL(`http://localhost/api/track/click/ext/${token}`))
  return GET(req, { params: Promise.resolve({ token }) })
}

describe('GET /api/track/click/ext/[token] — signed token + scheme validation (#591)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedClick = null
    rpcCalls = []
    trackedResult = { data: { id: 'te-1', team_member_id: 'tm-1', recipient_email: 'x@example.com', subject: 'Hi', contact_id: null, company_id: null, click_count: 0 } }
  })

  it('rejects an unsigned/forged token', async () => {
    const forged = Buffer.from(JSON.stringify({ trackedEmailId: 'te-1', url: 'https://evil.example.com' })).toString('base64url')
    const res = await clickRequest(forged)

    expect(res.status).toBe(400)
    expect(insertedClick).toBeNull()
  })

  it('rejects a tampered signed token', async () => {
    const token = signToken({ trackedEmailId: 'te-1', url: 'https://example.com/page' })
    const [body] = token.split('.')
    const tampered = `${body}.${'a'.repeat(43)}`
    const res = await clickRequest(tampered)

    expect(res.status).toBe(400)
    expect(insertedClick).toBeNull()
  })

  it('rejects a valid signed token whose URL uses an unsafe scheme', async () => {
    const token = signToken({ trackedEmailId: 'te-1', url: 'javascript:alert(1)' })
    const res = await clickRequest(token)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/redirect/i)
    expect(insertedClick).toBeNull()
  })

  it('records the click and redirects for a validly-signed http(s) URL', async () => {
    const token = signToken({ trackedEmailId: 'te-1', url: 'https://example.com/page' })
    const res = await clickRequest(token)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/page')
    expect(insertedClick).toEqual(expect.objectContaining({ tracked_email_id: 'te-1', url: 'https://example.com/page' }))
    expect(rpcCalls).toContainEqual(['increment_tracked_email_counts', { p_id: 'te-1', p_clicks: 1 }])
  })
})
