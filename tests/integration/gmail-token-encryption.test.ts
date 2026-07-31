import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #605 — team_members.gmail_access_token was stored and read as
// plain text, unlike every other OAuth integration (Google Calendar #101,
// Google Drive). Now encrypted at rest via lib/encryption.ts, matching
// that convention; decrypt() gracefully passes through any still-legacy
// plaintext value, so no backfill migration is needed.

let storedRow: {
  id: string
  name: string
  gmail_access_token: string | null
  gmail_email: string | null
  gmail_token_expires_at: string | null
  gmail_settings: unknown
  bcc_email: string | null
  status: string
} | null
let updatePayload: Record<string, unknown> | null

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: storedRow, error: storedRow ? null : { message: 'not found' } }))
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: storedRow, error: null }))
    chain.update = vi.fn((payload: Record<string, unknown>) => {
      updatePayload = payload
      const updateChain: Record<string, unknown> = {}
      updateChain.eq = vi.fn(() => Promise.resolve({ error: null }))
      return updateChain
    })
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/admin-auth', () => ({
  getAuthenticatedEmail: vi.fn(() => Promise.resolve('jamie@gravissmarketing.com')),
}))

import { GET, POST } from '@/app/api/gmail/token/route'

function getToken(email: string) {
  const req = new NextRequest(new URL(`http://localhost/api/gmail/token?email=${email}`))
  return GET(req)
}

function postToken(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/gmail/token'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('gmail/token — encrypts gmail_access_token at rest (#605)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storedRow = null
    updatePayload = null
    process.env.TOKEN_ENCRYPTION_KEY = 'test-key-for-gmail-token-encryption'
  })

  it('POST stores the token encrypted, not as plaintext', async () => {
    const res = await postToken({ userEmail: 'jamie@gravissmarketing.com', gmailToken: 'ya29.plaintext-access-token' })

    expect(res.status).toBe(200)
    expect(updatePayload?.gmail_access_token).not.toBe('ya29.plaintext-access-token')
    expect(String(updatePayload?.gmail_access_token)).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
  })

  it('GET decrypts an encrypted token back to its original value', async () => {
    // Round-trip: encrypt via POST's own code path isn't reused here, so
    // simulate a real encrypted value already sitting in the DB.
    const { encrypt } = await import('@/lib/encryption')
    storedRow = {
      id: 'tm-1', name: 'Jamie', gmail_access_token: encrypt('ya29.real-token'),
      gmail_email: 'jamie@gmail.com', gmail_token_expires_at: null, gmail_settings: null,
      bcc_email: 'jamie-abc123@log.gravissmarketing.com', status: 'active',
    }

    const res = await getToken('jamie@gravissmarketing.com')
    const json = await res.json()

    expect(json.gmailToken).toBe('ya29.real-token')
  })

  it('GET passes through a legacy plaintext token unchanged (no migration needed)', async () => {
    storedRow = {
      id: 'tm-1', name: 'Jamie', gmail_access_token: 'ya29.legacy-plaintext-token',
      gmail_email: 'jamie@gmail.com', gmail_token_expires_at: null, gmail_settings: null,
      bcc_email: 'jamie-abc123@log.gravissmarketing.com', status: 'active',
    }

    const res = await getToken('jamie@gravissmarketing.com')
    const json = await res.json()

    expect(json.gmailToken).toBe('ya29.legacy-plaintext-token')
  })
})
