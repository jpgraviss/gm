import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// "Remember me for 30 days" checkbox on the client-portal password sign-in
// form (app/login/page.tsx) — POST /api/auth/session accepts an optional
// {rememberMe: boolean} body and, when true, overrides the configured
// Session Timeout security setting with a fixed 30-day cookie lifetime
// (REMEMBER_ME_SECONDS, lib/session-cookie.ts).
//
// AUDIT — two real regressions this locks in the fix for:
// (1) rememberMe used to be honored for BOTH staff and client cookies, with
//     nothing server-side restricting it to the one flow with the checkbox
//     — any authenticated staff account could self-grant a 30-day cookie via
//     a raw {rememberMe: true} body, bypassing the admin's Session Timeout.
//     Now staff NEVER honors it, regardless of what the body says.
// (2) the choice was a pure one-shot request flag — the very next routine
//     token-refresh/mount-restore call (which never re-sends it) silently
//     rebuilt the cookie at the default timeout. Now it's carried forward
//     from a previously-issued, identity-matched cookie via the payload's
//     own `rememberMe` field, the same pattern twoFactorVerifiedAt uses.
//
// These tests spy on buildSessionCookie's maxAgeSeconds/payload arguments
// rather than parsing the raw Set-Cookie header.

const TEAM_ROW = {
  id: 'tm-1', email: 'staff@gravissmarketing.com', name: 'Staff Person',
  role: 'Team Member', is_admin: false, status: 'active', access_schedule: null,
}
const CLIENT_ROW = {
  id: 'client-1', email: 'client@example.com', access: 'Active', pending_approval: false,
}
const OTHER_CLIENT_ROW = {
  id: 'client-2', email: 'other-client@example.com', access: 'Active', pending_approval: false,
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
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: async () => {
                const email = getUserResult.data.user?.email
                if (email === CLIENT_ROW.email) return { data: CLIENT_ROW, error: null }
                if (email === OTHER_CLIENT_ROW.email) return { data: OTHER_CLIENT_ROW, error: null }
                return { data: null, error: null }
              },
            }),
          }),
        }
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
import { buildSessionCookie, signSessionCookie, REMEMBER_ME_SECONDS, sessionTimeoutToSeconds, SESSION_COOKIE_NAME } from '@/lib/session-cookie'

async function makeRequest(body?: object, existingCookieValue?: string) {
  const headers: Record<string, string> = { Authorization: 'Bearer fake-token', 'Content-Type': 'application/json' }
  if (existingCookieValue) headers.Cookie = `${SESSION_COOKIE_NAME}=${existingCookieValue}`
  return new NextRequest(new URL('http://localhost/api/auth/session'), {
    method: 'POST',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.mocked(buildSessionCookie).mockClear()
})

describe('POST /api/auth/session — remember me', () => {
  it('never honors rememberMe for a staff login, even when explicitly requested', async () => {
    getUserResult = { data: { user: { email: TEAM_ROW.email } }, error: null }
    const res = await POST(await makeRequest({ rememberMe: true }))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(sessionTimeoutToSeconds('8h'))
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).not.toBe(REMEMBER_ME_SECONDS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((vi.mocked(buildSessionCookie).mock.calls[0][0] as any).rememberMe).toBeUndefined()
  })

  it('uses the fixed 30-day lifetime for a portal-client login when rememberMe is true', async () => {
    getUserResult = { data: { user: { email: CLIENT_ROW.email } }, error: null }
    const res = await POST(await makeRequest({ rememberMe: true }))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(REMEMBER_ME_SECONDS)
  })

  it('falls back to the configured Session Timeout for a portal-client login when rememberMe is false', async () => {
    getUserResult = { data: { user: { email: CLIENT_ROW.email } }, error: null }
    const res = await POST(await makeRequest({ rememberMe: false }))
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

  it('carries a previously-granted remember-me forward across a refresh call that sends no rememberMe at all', async () => {
    getUserResult = { data: { user: { email: CLIENT_ROW.email } }, error: null }
    const priorCookie = await signSessionCookie({
      id: CLIENT_ROW.id, email: CLIENT_ROW.email, role: 'Client', isAdmin: false, userType: 'client', rememberMe: true,
    }, REMEMBER_ME_SECONDS)
    // Simulates a routine Supabase TOKEN_REFRESHED/mount-restore call —
    // establishSessionCookie() never re-sends the one-shot sessionStorage
    // flag, so the body carries no rememberMe field at all.
    const res = await POST(await makeRequest(undefined, priorCookie))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(REMEMBER_ME_SECONDS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((vi.mocked(buildSessionCookie).mock.calls[0][0] as any).rememberMe).toBe(true)
  })

  it('does not carry a remember-me cookie forward to a different client account', async () => {
    getUserResult = { data: { user: { email: OTHER_CLIENT_ROW.email } }, error: null }
    const priorCookieForSomeoneElse = await signSessionCookie({
      id: CLIENT_ROW.id, email: CLIENT_ROW.email, role: 'Client', isAdmin: false, userType: 'client', rememberMe: true,
    }, REMEMBER_ME_SECONDS)
    const res = await POST(await makeRequest(undefined, priorCookieForSomeoneElse))
    expect(res.status).toBe(200)
    expect(vi.mocked(buildSessionCookie).mock.calls[0][1]).toBe(sessionTimeoutToSeconds('8h'))
  })
})
