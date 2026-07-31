import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #569 — PATCH /api/proposals/[id] (the real authenticated portal-
// client Approvals accept/decline flow) had no atomic claim on the write,
// unlike the sibling public-link routes (#496). Two concurrent PATCHes
// could both read a non-terminal status and both fire
// proposal_accepted/proposal_declined. This asserts the fix: the write
// itself is conditioned on the proposal still being non-terminal for an
// Accept/Decline transition, and the automation only fires when that
// request actually claimed the row.

let currentProposalResult: { data: { company: string; company_id: string | null } | null; error: unknown }
let updateResult: { data: unknown; error: unknown }
let lastEqCalls: [string, unknown][]
let lastNotCalls: [string, unknown, unknown][]

const mockDb = {
  from: vi.fn(() => ({
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.single = vi.fn(() => Promise.resolve(currentProposalResult))
      return chain
    }),
    update: vi.fn(() => {
      lastEqCalls = []
      lastNotCalls = []
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn((k: string, v: unknown) => { lastEqCalls.push([k, v]); return chain })
      chain.not = vi.fn((k: string, op: unknown, v: unknown) => { lastNotCalls.push([k, op as unknown as string, v] as [string, unknown, unknown]); return chain })
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

import { PATCH } from '@/app/api/proposals/[id]/route'
import { fireAutomations } from '@/lib/automations-engine'

function patchProposal(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(new URL(`http://localhost/api/proposals/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id }) })
}

describe('PATCH /api/proposals/[id] — accept/decline race (#569)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentProposalResult = { data: { company: 'Acme Co', company_id: 'company-1' }, error: null }
  })

  it('conditions the write on the proposal still being non-terminal when accepting', async () => {
    updateResult = { data: { id: 'p-1', status: 'Accepted', company: 'Acme Co' }, error: null }

    const res = await patchProposal('p-1', { status: 'Accepted' })

    expect(res.status).toBe(200)
    expect(lastNotCalls).toContainEqual(['status', 'in', '(Accepted,Declined)'])
    expect(fireAutomations).toHaveBeenCalledWith('proposal_accepted', expect.objectContaining({ proposalId: 'p-1' }))
  })

  it('returns 409 and does not fire the automation when a concurrent request already claimed it', async () => {
    updateResult = { data: null, error: null }

    const res = await patchProposal('p-1', { status: 'Accepted' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/already been responded to/i)
    expect(fireAutomations).not.toHaveBeenCalled()
  })

  it('does not add the terminal-status guard to an unrelated field update', async () => {
    updateResult = { data: { id: 'p-1', status: 'Draft', value: 5000 }, error: null }

    const res = await patchProposal('p-1', { value: 5000 })

    expect(res.status).toBe(200)
    expect(lastNotCalls).toEqual([])
    expect(fireAutomations).not.toHaveBeenCalled()
  })

  it('does not add the terminal-status guard for a non-terminal status value', async () => {
    updateResult = { data: { id: 'p-1', status: 'Draft' }, error: null }

    const res = await patchProposal('p-1', { status: 'Draft' })

    expect(res.status).toBe(200)
    expect(lastNotCalls).toEqual([])
  })
})
