import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #586 — POST /api/tickets had no field whitelist for portal-client
// callers, unlike its PATCH sibling. A portal client could set companyId
// to a different real company while `company` (the only field
// requirePortalClient checks) stays their own, or directly target a
// specific staff member via assignedTo.

let insertPayload: Record<string, unknown> | null

// Scoped by table: this route also writes a cross-module timeline entry to
// crm_activities (lib/activity-log.ts), so an unscoped capture would record
// that instead of the ticket insert under test.
const mockDb = {
  from: vi.fn((table: string) => ({
    insert: vi.fn((payload: Record<string, unknown>) => {
      if (table === 'tickets') insertPayload = payload
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve({ data: { id: 'tkt-1', ...payload }, error: null }))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/portal-auth', () => ({
  requirePortalClient: vi.fn().mockResolvedValue(null),
  isStaffCaller: vi.fn(),
  blockIfPreview: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/ticket-routing', () => ({
  applyRoutingRules: vi.fn().mockResolvedValue(null),
  notifyRoutedAssignee: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/tickets/route'
import { isStaffCaller } from '@/lib/portal-auth'

function createTicket(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/tickets'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/tickets — portal-client field whitelist (#586)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertPayload = null
  })

  it('rejects a portal client trying to set companyId', async () => {
    vi.mocked(isStaffCaller).mockResolvedValue(false)

    const res = await createTicket({ subject: 'Help', company: 'Acme Co', companyId: 'other-company-id' })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toMatch(/companyId/)
    expect(insertPayload).toBeNull()
  })

  it('rejects a portal client trying to set assignedTo', async () => {
    vi.mocked(isStaffCaller).mockResolvedValue(false)

    const res = await createTicket({ subject: 'Help', company: 'Acme Co', assignedTo: 'Some Rep' })

    expect(res.status).toBe(403)
    expect(insertPayload).toBeNull()
  })

  it('forces isInternal:false on a portal client\'s submitted messages', async () => {
    vi.mocked(isStaffCaller).mockResolvedValue(false)

    const res = await createTicket({
      subject: 'Help', company: 'Acme Co',
      messages: [{ id: 'm-1', author: 'Client', isInternal: true, body: 'hi', timestamp: 'now' }],
    })

    expect(res.status).toBe(201)
    expect((insertPayload?.messages as Record<string, unknown>[])[0]).toEqual(
      expect.objectContaining({ isInternal: false }),
    )
  })

  it('allows a staff caller to set companyId and assignedTo', async () => {
    vi.mocked(isStaffCaller).mockResolvedValue(true)

    const res = await createTicket({ subject: 'Help', company: 'Acme Co', companyId: 'company-1', assignedTo: 'Jamie' })

    expect(res.status).toBe(201)
    expect(insertPayload).toEqual(expect.objectContaining({ company_id: 'company-1', assigned_to: 'Jamie' }))
  })
})
