import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Product decision: Google Sign-In (app/api/auth/google-verify/route.ts) is
// exempt from the "Two-Factor Auth: Required" security setting — Google's
// own sign-in already requires authenticating against a Google account.
// This locks in that a staff member signing in via Google gets a full
// session immediately even when Required is on, with no {requires2FA: true}
// interruption (unlike the magic-link path, /api/auth/session, which still
// enforces it).

const TEAM_ROW = {
  id: 'tm-1', email: 'staff@gravissmarketing.com', name: 'Staff Person',
  role: 'Team Member', unit: 'Leadership/Admin', initials: 'SP',
  is_admin: false, status: 'active', access_schedule: null,
}
const GOOGLE_CLIENT_ID = 'test-google-client-id'

function makeMockDb() {
  return {
    from: (table: string) => {
      if (table === 'team_members') {
        return { select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: TEAM_ROW, error: null }) }) }) }
      }
      throw new Error(`Unexpected table in mock: ${table}`)
    },
  }
}

function makeFakeGoogleCredential(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fake-signature`
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => makeMockDb() }))
vi.mock('@/lib/login-attempts', () => ({
  isLockedOut: vi.fn(() => false),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(),
}))
vi.mock('@/lib/two-factor', () => ({ sendTwoFactorCode: vi.fn() }))

let securityTwoFactor: 'required' | 'disabled'
vi.mock('@/lib/settings', () => ({
  getSecuritySettings: vi.fn(async () => ({
    sessionTimeout: '8h', passwordPolicy: 'strong', twoFactor: securityTwoFactor,
    loginAttempts: 5, auditLogging: true, ipRestriction: 'disabled',
  })),
}))

import { POST } from '@/app/api/auth/google-verify/route'
import { sendTwoFactorCode } from '@/lib/two-factor'

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID
  vi.mocked(sendTwoFactorCode).mockClear()
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ aud: GOOGLE_CLIENT_ID, email: TEAM_ROW.email }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any)
})

function makeRequest(credential: string) {
  return new NextRequest(new URL('http://localhost/api/auth/google-verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
}

describe('POST /api/auth/google-verify — 2FA exemption', () => {
  it('signs a staff member straight in even when Two-Factor Auth is Required', async () => {
    securityTwoFactor = 'required'
    const credential = makeFakeGoogleCredential({ email: TEAM_ROW.email, exp: Math.floor(Date.now() / 1000) + 3600 })
    const res = await POST(makeRequest(credential))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user?.email).toBe(TEAM_ROW.email)
    expect(data.requires2FA).toBeUndefined()
    expect(sendTwoFactorCode).not.toHaveBeenCalled()
  })

  it('still signs in normally when Two-Factor Auth is disabled (unaffected baseline)', async () => {
    securityTwoFactor = 'disabled'
    const credential = makeFakeGoogleCredential({ email: TEAM_ROW.email, exp: Math.floor(Date.now() / 1000) + 3600 })
    const res = await POST(makeRequest(credential))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user?.email).toBe(TEAM_ROW.email)
    expect(data.requires2FA).toBeUndefined()
  })
})
