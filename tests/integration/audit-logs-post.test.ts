import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #564 — POST /api/audit-logs previously took `user_name` straight
// from the request body, so any authenticated admin caller could forge the
// internal audit trail's own "who did this" field. This asserts the real
// fix: attribution is derived server-side from the verified session, and
// the raw insert path now honors the Audit Logging toggle like every other
// logAudit() call site already does.

let insertedPayload: Record<string, unknown> | null
let auditLoggingEnabled: boolean

const mockDb = {
  from: vi.fn(() => ({
    insert: vi.fn((payload: Record<string, unknown>) => {
      insertedPayload = payload
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve({
        data: { id: payload.id, ...payload },
        error: null,
      }))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/admin-auth', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))

vi.mock('@/lib/settings', () => ({
  getSecuritySettings: vi.fn().mockResolvedValue({ auditLogging: true }),
}))

import { POST } from '@/app/api/audit-logs/route'
import { getSecuritySettings } from '@/lib/settings'

function postAuditLog(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/audit-logs'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedPayload = null
    auditLoggingEnabled = true
    vi.mocked(getSecuritySettings).mockResolvedValue({ auditLogging: auditLoggingEnabled } as never)
  })

  it('attributes the entry to the real authenticated caller, ignoring any user field in the request body', async () => {
    const res = await postAuditLog({ user: 'Someone Else', action: 'did_a_thing', module: 'crm' })

    expect(res.status).toBe(201)
    expect(insertedPayload?.user_name).toBe('Jamie Rivera')
  })

  it('falls back to email when the caller has no name', async () => {
    const { getAuthUser } = await import('@/lib/rbac')
    vi.mocked(getAuthUser).mockResolvedValueOnce({ name: '', email: 'jamie@gravissmarketing.com' } as never)

    await postAuditLog({ user: 'Forged Name', action: 'did_a_thing', module: 'crm' })

    expect(insertedPayload?.user_name).toBe('jamie@gravissmarketing.com')
  })

  it('refuses to insert when Audit Logging is disabled, honoring the same toggle logAudit() respects', async () => {
    vi.mocked(getSecuritySettings).mockResolvedValue({ auditLogging: false } as never)

    const res = await postAuditLog({ user: 'Someone Else', action: 'did_a_thing', module: 'crm' })

    expect(res.status).toBe(409)
    expect(insertedPayload).toBeNull()
  })
})
