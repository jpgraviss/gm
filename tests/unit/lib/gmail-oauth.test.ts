import { describe, it, expect, beforeEach, vi } from 'vitest'

// AUDIT #23 — Gmail was connected through Google Identity Services' browser
// token client, which never issues a refresh token, so every connection died
// after ~1 hour and took the inbox poller and sequence reply-detection with
// it. These tests pin the properties of the replacement: the consent URL
// actually asks for a refresh token, a stale token renews itself and is
// persisted, and a connection that genuinely can't be renewed reports null
// rather than handing back a dead token.

const updates: { table: string; payload: Record<string, unknown>; id: string }[] = []

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (_c: string, id: string) => { updates.push({ table, payload, id }); return { error: null } },
      }),
    }),
  }),
}))

// Encryption is exercised by its own suite; here it just needs to round-trip
// so the token that comes back out is the one that went in.
vi.mock('@/lib/encryption', () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

import {
  getGmailAuthUrl,
  getValidGmailToken,
  isGmailOAuthConfigured,
  GMAIL_SCOPES,
} from '@/lib/gmail-oauth'

const fetchMock = vi.fn()
const future = (ms: number) => new Date(Date.now() + ms).toISOString()

beforeEach(() => {
  updates.length = 0
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  process.env.GOOGLE_CLIENT_ID = 'cid'
  process.env.GOOGLE_CLIENT_SECRET = 'secret'
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
})

describe('consent URL', () => {
  it('requests offline access and forces re-consent', () => {
    // Both are required to actually receive a refresh token, and are exactly
    // what the browser token client could not send — the whole bug.
    const url = new URL(getGmailAuthUrl('state123'))
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('state123')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/api/gmail/callback')
  })

  it('keeps the scopes the old browser flow used', () => {
    const scope = new URL(getGmailAuthUrl('s')).searchParams.get('scope')!
    for (const s of GMAIL_SCOPES) expect(scope).toContain(s)
  })

  it('reports unconfigured when the client secret is missing', () => {
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(isGmailOAuthConfigured()).toBe(false)
  })
})

describe('getValidGmailToken', () => {
  it('uses the stored token while it is still comfortably valid', async () => {
    const token = await getValidGmailToken({
      id: 'tm-1',
      gmail_access_token: 'enc:live-token',
      gmail_refresh_token: 'enc:refresh',
      gmail_token_expires_at: future(60 * 60 * 1000),
    })
    expect(token).toBe('live-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a token that is inside the expiry buffer, and persists it', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
    })
    const token = await getValidGmailToken({
      id: 'tm-1',
      gmail_access_token: 'enc:stale',
      gmail_refresh_token: 'enc:refresh',
      // 30s left: technically unexpired, but a request could straddle it.
      gmail_token_expires_at: future(30_000),
    })
    expect(token).toBe('fresh-token')
    expect(updates).toHaveLength(1)
    expect(updates[0].table).toBe('team_members')
    expect(updates[0].id).toBe('tm-1')
    expect(updates[0].payload.gmail_access_token).toBe('enc:fresh-token')
  })

  it('sends the refresh grant, not an authorization code', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) })
    await getValidGmailToken({
      id: 'tm-1', gmail_access_token: null,
      gmail_refresh_token: 'enc:my-refresh', gmail_token_expires_at: null,
    })
    const body = String(fetchMock.mock.calls[0][1].body)
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=my-refresh')
  })

  it('returns null — never a dead token — when the refresh is rejected', async () => {
    // A revoked grant or changed password. The caller must treat this as
    // "not connected", not retry with a token Google will reject.
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' })
    const token = await getValidGmailToken({
      id: 'tm-1', gmail_access_token: 'enc:stale',
      gmail_refresh_token: 'enc:refresh', gmail_token_expires_at: future(-1000),
    })
    expect(token).toBeNull()
    expect(updates).toHaveLength(0)
  })

  it('keeps working for a legacy connection whose token has not expired yet', async () => {
    // Accounts connected before this existed have no refresh token. They
    // must not break — they keep exactly the old behavior until reconnected.
    const token = await getValidGmailToken({
      id: 'tm-1', gmail_access_token: 'enc:legacy',
      gmail_refresh_token: null, gmail_token_expires_at: future(10 * 60 * 1000),
    })
    expect(token).toBe('legacy')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a legacy connection with no recorded expiry as usable', async () => {
    // A missing expiry means we never stored one, not that the token is
    // stale. Every call site this replaced treated null expiry as usable;
    // returning null would silently disconnect those accounts — a worse bug
    // than the one this module fixes.
    const token = await getValidGmailToken({
      id: 'tm-1', gmail_access_token: 'enc:legacy',
      gmail_refresh_token: null, gmail_token_expires_at: null,
    })
    expect(token).toBe('legacy')
  })

  it('returns null for a legacy connection whose token has expired', async () => {
    const token = await getValidGmailToken({
      id: 'tm-1', gmail_access_token: 'enc:legacy',
      gmail_refresh_token: null, gmail_token_expires_at: future(-60_000),
    })
    expect(token).toBeNull()
  })

  it('returns null when nothing is connected at all', async () => {
    expect(await getValidGmailToken({ id: 'tm-1' })).toBeNull()
  })

  it('writes back to the table it was told to', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) })
    await getValidGmailToken(
      { id: 'as-1', gmail_refresh_token: 'enc:r', gmail_token_expires_at: future(-1) },
      'app_settings',
    )
    expect(updates[0].table).toBe('app_settings')
  })
})
