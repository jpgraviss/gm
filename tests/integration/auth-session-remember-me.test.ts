import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// "Remember me for 30 days" checkbox on the password sign-in form
// (app/login/page.tsx) — POST /api/auth/session now accepts an optional
// {rememberMe: boolean} body and, when true, overrides the configured
// Session Timeout security setting with a fixed 30-day cookie lifetime
// (REMEMBER_ME_SECONDS, lib/session-cookie.ts) for both the staff and
// portal-client branches. These tests spy on buildSessionCookie's
// maxAgeSeconds argument rather than parsing the raw Set-Cookie header.

const TEAM_ROW = {
  id: 'tm-1', email: 'staff@gravissmarketing.com', name: 'Staff Person',
  role: 'Team Member', is_admin: false, status: 'active', access_schedule: null,
}
const CLIENT_ROW = {
  id: 'client-1', email: 'client@example.com', access: 'Active', pending_approval: false,
}

let getUserResult: { data: { user: { email: string } | null }; error: { message: string } | null }

function makeMockDb() {
  return {
    auth: { getUser: vi.fn(async () => getUserResult) },
    from: (table: string) => {
      if (table === 'team_members') {
        return { select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: getUserResult.data.user?.email === TEAM_ROW.email ? TEAM_ROW : null, error: null }) }) }) }
      }
      if (table === 'portal_clients') {
        return { select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: getUserResult.data.user?.email === CLIENT_ROW.email ? CLIENT_ROW : null, error: null }) }) }) }
      }
      throw new Error(`Unexpected table in mock: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => makeMockDb() }))
vi.mock('@/lib/settings', () => ({
  getSecuritySettings: vi.fn().mockResolvedValue({
    sessionTimeout: '8h', passwordPolicy: 'strong', twoFactor: 'disabled',
    loginAttempts: 5, auditLogging: true, ipRestriction: 'disabled',
  }),
}))
vi.mock('@/lib/two-factor', () => ({ sendTwoFactorCode: vi.fn() }))

vi.mock('@/lib/session-cookie', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session-cookie')>()
  return { ...actual, buildSessionCookie: vi.fn(actual.buildSessionCookie) }
})

import { POST } from '@/app/api/auth/session/route'
import { buildSessionCookie, REMEMBER_ME_SECONDS, sessionTimeoutToSeconds } from '@/lib/session-cookie'

function makeRequest(body?: object) {
  return new NextRequest(new URL('http://localhost/api/auth/session'), {
    method: 'POST',
    headers: { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.mocked(buildSessionCookie).mockClear()
})

describe('POST /api/auth/session — remember me', () => {
  it('uses the fixed 30-day lifetime for a staff login when rememberMe is true', async () => {
    getUserResult = { data: { user: { email: TEAM_ROW.email } }, error: null }
    const res = await POST(makeRequest({ rememberMe: true }))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(REMEMBER_ME_SECONDS)
  })

  it('falls back to the configured Session Timeout for a staff login when rememberMe is false/omitted', async () => {
    getUserResult = { data: { user: { email: TEAM_ROW.email } }, error: null }
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(sessionTimeoutToSeconds('8h'))
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).not.toBe(REMEMBER_ME_SECONDS)
  })

  it('uses the fixed 30-day lifetime for a portal-client login when rememberMe is true', async () => {
    getUserResult = { data: { user: { email: CLIENT_ROW.email } }, error: null }
    const res = await POST(makeRequest({ rememberMe: true }))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(REMEMBER_ME_SECONDS)
  })

  it('falls back to the configured Session Timeout for a portal-client login when rememberMe is false', async () => {
    getUserResult = { data: { user: { email: CLIENT_ROW.email } }, error: null }
    const res = await POST(makeRequest({ rememberMe: false }))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(sessionTimeoutToSeconds('8h'))
  })

  it('does not throw when no body is sent at all (routine session-restore/refresh callers)', async () => {
    getUserResult = { data: { user: { email: TEAM_ROW.email } }, error: null }
    const req = new NextRequest(new URL('http://localhost/api/auth/session'), {
      method: 'POST',
      headers: { Authorization: 'Bearer fake-token' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(sessionTimeoutToSeconds('8h'))
  })
})
