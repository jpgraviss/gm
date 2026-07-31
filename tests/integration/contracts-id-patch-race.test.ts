import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #597 — PATCH /api/contracts/[id] (the real route app/client/approvals
// calls to sign/decline, and staff use to countersign) had no atomic claim
// on the write, unlike the sibling proposals route (#569). Two concurrent
// PATCHes could both pass the VALID_TRANSITIONS check and both write, each
// firing contract_executed/contract_sent for one real transition. Asserts
// the fix: a status-changing write is conditioned on `status` still
// matching the value read moments earlier, and the automation only fires
// when that request actually claimed the row.

let currentContractResult: { data: { status: string; company: string; company_id: string | null } | null; error: unknown }
let updateResult: { data: unknown; error: unknown }
let lastEqCalls: [string, unknown][]

const mockDb = {
  from: vi.fn(() => ({
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve(currentContractResult))
      return chain
    }),
    update: vi.fn(() => {
      lastEqCalls = []
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn((k: string, v: unknown) => { lastEqCalls.push([k, v]); return chain })
      chain.select = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => Promise.resolve(updateResult))
      return chain
    }),
  })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
  requireRole: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/portal-auth', () => ({
  requirePortalClient: vi.fn().mockResolvedValue(null),
  isStaffCaller: vi.fn().mockResolvedValue(true),
  blockIfPreview: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))

import { PATCH } from '@/app/api/contracts/[id]/route'
import { fireAutomations } from '@/lib/automations-engine'

function patchContract(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(new URL(`http://localhost/api/contracts/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id }) })
}

describe('PATCH /api/contracts/[id] — countersign race (#597)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentContractResult = { data: { status: 'Signed by Client', company: 'Acme Co', company_id: 'company-1' }, error: null }
  })

  it('conditions the write on the status still matching what was just read', async () => {
    updateResult = { data: { id: 'c-1', status: 'Fully Executed', company: 'Acme Co' }, error: null }

    const res = await patchContract('c-1', { status: 'Fully Executed' })

    expect(res.status).toBe(200)
    expect(lastEqCalls).toContainEqual(['status', 'Signed by Client'])
    expect(fireAutomations).toHaveBeenCalledWith('contract_executed', expect.objectContaining({ contractId: 'c-1' }))
  })

  it('returns 409 and does not fire the automation when a concurrent request already claimed it', async () => {
    updateResult = { data: null, error: null }

    const res = await patchContract('c-1', { status: 'Fully Executed' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/updated by someone else/i)
    expect(fireAutomations).not.toHaveBeenCalled()
  })

  it('does not add the status guard to an unrelated field update', async () => {
    updateResult = { data: { id: 'c-1', status: 'Signed by Client', value: 5000 }, error: null }

    const res = await patchContract('c-1', { value: 5000 })

    expect(res.status).toBe(200)
    expect(lastEqCalls).not.toContainEqual(['status', 'Signed by Client'])
    expect(fireAutomations).not.toHaveBeenCalled()
  })
})
