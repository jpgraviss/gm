import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #439 — app/api/auth/2fa-verify/route.ts now also records the
// caller's live Supabase Auth session (identified by the standard
// `session_id` JWT claim) as 2FA-verified, so RLS's staff_two_factor_ok()
// (supabase/migrations/enforce_2fa_session_rls.sql) starts accepting it.
// These tests cover that new behavior in isolation from the SQL side,
// which vitest can't exercise directly.

const MOCK_MEMBER = {
  id: 'tm-1',
  name: 'Jonathan Graviss',
  email: 'staff@gravissmarketing.com',
  role: 'Super Admin',
  unit: 'Leadership/Admin',
  initials: 'JG',
  is_admin: true,
  status: 'active',
  access_schedule: null,
}

function makeFakeSupabaseJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Signature is never verified by the route itself — it trusts the token
  // only after db.auth.getUser() (mocked below) independently confirms it,
  // exactly like the real Supabase call would. A fake signature segment is
  // enough to exercise decodeJwtSessionId's parsing.
  return `${header}.${body}.fake-signature`
}

let upsertCalls: Array<{ session_id: string; user_id: string }>
let getUserResult: { data: { user: { id: string; email: string } | null }; error: { message: string } | null }

function makeMockDb() {
  return {
    auth: {
      getUser: vi.fn(async () => getUserResult),
    },
    from: (table: string) => {
      if (table === 'team_members') {
        return {
          select: () => ({
            ilike: () => ({
              maybeSingle: async () => ({ data: MOCK_MEMBER, error: null }),
            }),
          }),
        }
      }
      if (table === 'two_factor_verified_sessions') {
        return {
          upsert: vi.fn(async (row: { session_id: string; user_id: string }) => {
            upsertCalls.push(row)
            return { data: null, error: null }
          }),
        }
      }
      throw new Error(`Unexpected table in mock: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => makeMockDb(),
}))

vi.mock('@/lib/two-factor', () => ({
  verifyTwoFactorCode: vi.fn(async (_id: string, code: string) => code === '123456'),
}))

vi.mock('@/lib/settings', () => ({
  getSecuritySettings: vi.fn().mockResolvedValue({
    sessionTimeout: '8h',
    passwordPolicy: 'strong',
    twoFactor: 'required',
    loginAttempts: 5,
    auditLogging: true,
    ipRestriction: 'disabled',
  }),
}))

vi.mock('@/lib/login-attempts', () => ({
  isLockedOut: vi.fn(() => false),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(),
}))

import { POST } from '@/app/api/auth/2fa-verify/route'

function makeRequest(body: object, headers?: Record<string, string>) {
  return new NextRequest(new URL('http://localhost/api/auth/2fa-verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  upsertCalls = []
  getUserResult = { data: { user: { id: 'supabase-user-1', email: 'staff@gravissmarketing.com' } }, error: null }
})

describe('POST /api/auth/2fa-verify', () => {
  it('records the Supabase session as 2FA-verified when a matching bearer token is supplied', async () => {
    const token = makeFakeSupabaseJwt({ sub: 'supabase-user-1', email: 'staff@gravissmarketing.com', session_id: 'session-abc-123' })
    const res = await POST(makeRequest(
      { email: 'staff@gravissmarketing.com', code: '123456' },
      { Authorization: `Bearer ${token}` },
    ))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user?.email).toBe('staff@gravissmarketing.com')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]).toEqual({ session_id: 'session-abc-123', user_id: 'supabase-user-1' })
  })

  it('does not record a session when no Authorization header is present (e.g. Google Sign-In, no Supabase session)', async () => {
    const res = await POST(makeRequest({ email: 'staff@gravissmarketing.com', code: '123456' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user?.email).toBe('staff@gravissmarketing.com')
    expect(upsertCalls).toHaveLength(0)
  })

  it('does not record a session when the bearer token belongs to a different email', async () => {
    getUserResult = { data: { user: { id: 'supabase-user-1', email: 'someone-else@gravissmarketing.com' } }, error: null }
    const token = makeFakeSupabaseJwt({ sub: 'supabase-user-1', email: 'someone-else@gravissmarketing.com', session_id: 'session-abc-123' })
    const res = await POST(makeRequest(
      { email: 'staff@gravissmarketing.com', code: '123456' },
      { Authorization: `Bearer ${token}` },
    ))

    expect(res.status).toBe(200)
    expect(upsertCalls).toHaveLength(0)
  })

  it('never verifies/records a session when the 2FA code itself is wrong', async () => {
    const token = makeFakeSupabaseJwt({ sub: 'supabase-user-1', email: 'staff@gravissmarketing.com', session_id: 'session-abc-123' })
    const res = await POST(makeRequest(
      { email: 'staff@gravissmarketing.com', code: '000000' },
      { Authorization: `Bearer ${token}` },
    ))

    expect(res.status).toBe(400)
    expect(upsertCalls).toHaveLength(0)
  })

  it('does not throw when db.auth.getUser errors out — 2FA/cookie flow still succeeds', async () => {
    getUserResult = { data: { user: null }, error: { message: 'invalid token' } }
    const token = makeFakeSupabaseJwt({ sub: 'supabase-user-1', email: 'staff@gravissmarketing.com', session_id: 'session-abc-123' })
    const res = await POST(makeRequest(
      { email: 'staff@gravissmarketing.com', code: '123456' },
      { Authorization: `Bearer ${token}` },
    ))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user?.email).toBe('staff@gravissmarketing.com')
    expect(upsertCalls).toHaveLength(0)
  })
})
