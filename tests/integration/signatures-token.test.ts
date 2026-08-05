import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { computeContractDocumentHash } from '@/lib/contract-hash'

// AUDIT.md #515/#532 — the auto-created internal countersignature row never
// set document_hash, so the #497 tamper check (`if (sigReq.document_hash &&
// contract)`) silently skipped for every internal countersignature — a
// contract edited between the client's signature and the internal
// countersign went undetected. This file asserts the actual fix: the
// insert now sets document_hash the same way the client-facing request does.

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const CONTRACT = {
  company: 'Acme Corp',
  value: 5000,
  service_type: 'SEO',
  items: [{ name: 'SEO Package', price: 500 }],
  notes: 'Standard terms',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
}

let sigReqResult: { data: unknown; error: unknown }
let updateResult: { data: unknown; error: unknown }
let allSigsResult: { data: unknown[]; error: unknown }
let contractResult: { data: unknown; error: unknown }
let contractUpdateResult: { data: unknown; error: unknown }
let insertedSigReqPayload: Record<string, unknown> | null

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'signature_requests') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.single = vi.fn(() => Promise.resolve(sigReqResult))
          chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(allSigsResult).then(resolve, reject)
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.select = vi.fn(() => chain)
          chain.maybeSingle = vi.fn(() => Promise.resolve(updateResult))
          return chain
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedSigReqPayload = payload
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }
    if (table === 'contracts') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.single = vi.fn(() => Promise.resolve(contractResult))
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.select = vi.fn(() => chain)
          chain.maybeSingle = vi.fn(() => Promise.resolve(contractUpdateResult))
          chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject)
          return chain
        }),
      }
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })) }
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))

import { PATCH } from '@/app/api/signatures/[token]/route'
import { fireAutomations as mockFireAutomations } from '@/lib/automations-engine'

function patchSignature(token: string, body: Record<string, unknown>) {
  const req = new NextRequest(new URL(`http://localhost/api/signatures/${token}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ token }) })
}

describe('PATCH /api/signatures/[token] — internal countersignature document_hash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedSigReqPayload = null
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    contractResult = { data: CONTRACT, error: null }
    contractUpdateResult = { data: { id: 'contract-1', status: 'Fully Executed', ...CONTRACT }, error: null }
    allSigsResult = { data: [{ type: 'client', status: 'signed' }], error: null }
    updateResult = {
      data: {
        id: 'sig-1', contract_id: 'contract-1', token: 'tok-abc',
        signer_email: 'jane@acmeco.com', signer_name: 'Jane Client',
        type: 'client', status: 'signed', signed_at: '2026-01-15T00:00:00Z',
        signer_ip: '1.2.3.4', created_at: '2026-01-01T00:00:00Z', expires_at: null,
      },
      error: null,
    }
  })

  it('sets document_hash on the auto-created internal countersignature, matching the client-facing hash', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'client', status: 'pending', signer_email: 'jane@acmeco.com', signer_name: 'Jane Client',
        document_hash: computeContractDocumentHash(CONTRACT), expires_at: null,
      },
      error: null,
    }

    const res = await patchSignature('tok-abc', { signerName: 'Jane Client', signatureData: 'data:image/png;base64,abc' })

    expect(res.status).toBe(200)
    expect(insertedSigReqPayload).not.toBeNull()
    expect(insertedSigReqPayload?.type).toBe('internal')
    expect(insertedSigReqPayload?.document_hash).toBe(computeContractDocumentHash(CONTRACT))
  })

  it('sets document_hash to null, not left unset, when the contract can\'t be found for the countersignature', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'client', status: 'pending', signer_email: 'jane@acmeco.com', signer_name: 'Jane Client',
        document_hash: null, expires_at: null,
      },
      error: null,
    }
    contractResult = { data: null, error: null }

    await patchSignature('tok-abc', { signerName: 'Jane Client', signatureData: 'data:image/png;base64,abc' })

    expect(insertedSigReqPayload?.document_hash).toBeNull()
  })

  it('blocks signing with 409 when the contract has changed since the request was sent, before ever reaching the internal-countersign insert', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'client', status: 'pending', signer_email: 'jane@acmeco.com', signer_name: 'Jane Client',
        document_hash: 'stale-hash-from-before-the-edit', expires_at: null,
      },
      error: null,
    }

    const res = await patchSignature('tok-abc', { signerName: 'Jane Client', signatureData: 'data:image/png;base64,abc' })

    expect(res.status).toBe(409)
    expect(insertedSigReqPayload).toBeNull()
  })
})

// AUDIT #691 — the real e-signature completion flow (this route) never
// fired the 'contract_executed' automation trigger when both signatures
// landed, unlike the staff-manual-status-change PATCH route
// (app/api/contracts/[id]/route.ts). Any automation built on "Contract
// Fully Executed" silently never ran for a genuinely-signed contract.
describe('PATCH /api/signatures/[token] — contract_executed automation trigger (#691)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedSigReqPayload = null
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    contractResult = { data: CONTRACT, error: null }
    contractUpdateResult = { data: { id: 'contract-1', status: 'Fully Executed', ...CONTRACT }, error: null }
    updateResult = {
      data: {
        id: 'sig-1', contract_id: 'contract-1', token: 'tok-abc',
        signer_email: 'internal@gravissmarketing.com', signer_name: 'Jonathan Graviss',
        type: 'internal', status: 'signed', signed_at: '2026-01-15T00:00:00Z',
        signer_ip: '1.2.3.4', created_at: '2026-01-01T00:00:00Z', expires_at: null,
      },
      error: null,
    }
  })

  it('fires contract_executed once both signatures are in', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'internal', status: 'pending', signer_email: 'internal@gravissmarketing.com', signer_name: 'Jonathan Graviss',
        document_hash: computeContractDocumentHash(CONTRACT), expires_at: null,
      },
      error: null,
    }
    allSigsResult = { data: [{ type: 'client', status: 'signed' }, { type: 'internal', status: 'signed' }], error: null }

    const res = await patchSignature('tok-abc', { signerName: 'Jonathan Graviss', signatureData: 'data:image/png;base64,abc' })

    expect(res.status).toBe(200)
    expect(mockFireAutomations).toHaveBeenCalledWith('contract_executed', expect.objectContaining({ contractId: 'contract-1', status: 'Fully Executed' }))
  })

  it('does not fire contract_executed when only one side has signed', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'client', status: 'pending', signer_email: 'jane@acmeco.com', signer_name: 'Jane Client',
        document_hash: computeContractDocumentHash(CONTRACT), expires_at: null,
      },
      error: null,
    }
    allSigsResult = { data: [{ type: 'client', status: 'signed' }], error: null }

    await patchSignature('tok-abc', { signerName: 'Jane Client', signatureData: 'data:image/png;base64,abc' })

    expect(mockFireAutomations).not.toHaveBeenCalled()
  })

  it('does not auto-transition or fire the trigger when the contract was independently Terminated', async () => {
    sigReqResult = {
      data: {
        id: 'sig-1', token: 'tok-abc', contract_id: 'contract-1',
        type: 'internal', status: 'pending', signer_email: 'internal@gravissmarketing.com', signer_name: 'Jonathan Graviss',
        document_hash: computeContractDocumentHash(CONTRACT), expires_at: null,
      },
      error: null,
    }
    contractResult = { data: { ...CONTRACT, status: 'Terminated' }, error: null }
    allSigsResult = { data: [{ type: 'client', status: 'signed' }, { type: 'internal', status: 'signed' }], error: null }

    const res = await patchSignature('tok-abc', { signerName: 'Jonathan Graviss', signatureData: 'data:image/png;base64,abc' })

    expect(res.status).toBe(200)
    expect(mockFireAutomations).not.toHaveBeenCalled()
  })
})
