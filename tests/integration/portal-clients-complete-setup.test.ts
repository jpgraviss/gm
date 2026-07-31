import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #570 — displayName (free-text, supplied by the portal client
// completing setup) was interpolated unescaped into the "Pending Approval"
// HTML email sent to every admin inbox. Asserts the fix: the sent HTML
// carries the escaped form, and no raw "<script" survives into it.

function makeChain(result: { data?: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.ilike = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

let clientResult: { data: unknown; error: unknown }
let adminsResult: { data: unknown[]; error: unknown }
let settingsRowResult: { data: unknown; error: unknown }
let sentEmails: { to: string; subject: string; html: string }[]

const mockDb = {
  auth: {
    admin: {
      listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      updateUserById: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  from: vi.fn((table: string) => {
    if (table === 'portal_clients') {
      return {
        select: vi.fn(() => makeChain(clientResult)),
        update: vi.fn(() => makeChain({ error: null })),
      }
    }
    if (table === 'team_members') {
      return { select: vi.fn(() => makeChain(adminsResult)) }
    }
    if (table === 'app_settings') {
      return { select: vi.fn(() => makeChain(settingsRowResult)) }
    }
    return { select: vi.fn(() => makeChain({ data: null, error: null })) }
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn((args: { to: string; subject: string; html: string }) => {
    sentEmails.push(args)
    return Promise.resolve()
  }),
}))

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    branding: { darkBg: '#012A1C', primaryColor: '#CC7853' },
    company: { name: 'Graviss Marketing' },
  }),
  getSecuritySettings: vi.fn().mockResolvedValue({ passwordPolicy: 'Basic' }),
  passwordPolicyMinLength: vi.fn().mockReturnValue(8),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { POST } from '@/app/api/portal-clients/complete-setup/route'

function completeSetup(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/portal-clients/complete-setup'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/portal-clients/complete-setup — admin email escaping (#570)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sentEmails = []
    clientResult = {
      data: { id: 'pc-1', company: 'Acme Co', contact: 'Old Name', verification_code: '123456', verification_expires: null },
      error: null,
    }
    adminsResult = { data: [{ email: 'admin@gravissmarketing.com', name: 'Admin' }], error: null }
    settingsRowResult = { data: { approval_config: null }, error: null }
  })

  it('escapes a script-tag payload in displayName before it reaches the admin HTML email', async () => {
    const res = await completeSetup({
      email: 'client@example.com',
      code: '123456',
      password: 'a-strong-password',
      displayName: '<script>alert(1)</script>',
    })

    expect(res.status).toBe(200)
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].html).not.toContain('<script>alert(1)</script>')
    expect(sentEmails[0].html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapes the company name in the admin email too', async () => {
    clientResult = {
      data: { id: 'pc-1', company: '<img src=x onerror=alert(1)>', contact: 'Old Name', verification_code: '123456', verification_expires: null },
      error: null,
    }

    await completeSetup({ email: 'client@example.com', code: '123456', password: 'a-strong-password' })

    expect(sentEmails[0].html).not.toContain('<img src=x onerror=alert(1)>')
    expect(sentEmails[0].html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('still uses the raw name in the plain-text subject line (not HTML-rendered)', async () => {
    await completeSetup({
      email: 'client@example.com',
      code: '123456',
      password: 'a-strong-password',
      displayName: 'Jane & Co',
    })

    expect(sentEmails[0].subject).toBe('Portal Client Pending Approval: Jane & Co')
  })
})
