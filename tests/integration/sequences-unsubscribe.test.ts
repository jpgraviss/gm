import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { signToken } from '@/lib/signed-token'
import { buildSequenceUnsubscribeUrl } from '@/lib/sequence-unsubscribe'

// AUDIT #608 — POST /api/sequences/unsubscribe (the real, live unsubscribe
// link embedded in every sequence/broadcast send) previously accepted a raw
// {email, seq} body with zero proof the caller ever received that email —
// anyone who knew/scripted through a list of addresses could permanently
// suppress them org-wide. Asserts the fix: the route now requires a signed
// token (minted only by buildSequenceUnsubscribeUrl, embedded in real
// sends) and rejects a forged/raw body.

let upsertPayload: Record<string, unknown> | null
let enrollmentsResult: { data: { id: string; sequence_id: string }[] | null }

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'sequence_suppression_list') {
      return { upsert: vi.fn((payload: Record<string, unknown>) => { upsertPayload = payload; return Promise.resolve({ error: null }) }) }
    }
    if (table === 'sequence_enrollments') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.then = (resolve: (v: unknown) => void) => Promise.resolve(enrollmentsResult).then(resolve)
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.in = vi.fn(() => Promise.resolve({ error: null }))
          return chain
        }),
      }
    }
    if (table === 'sequence_activities') {
      return { insert: vi.fn(() => Promise.resolve({ error: null })) }
    }
    if (table === 'crm_contacts') {
      return {
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.contains = vi.fn(() => Promise.resolve({ error: null }))
          return chain
        }),
      }
    }
    return { select: vi.fn() }
  }),
  rpc: vi.fn(() => Promise.resolve({ error: null })),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

import { POST } from '@/app/api/sequences/unsubscribe/route'

function unsubscribeRequest(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/sequences/unsubscribe'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/sequences/unsubscribe — signed token required (#608)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsertPayload = null
    enrollmentsResult = { data: [] }
  })

  it('rejects a raw {email, seq} body with no token', async () => {
    const res = await unsubscribeRequest({ email: 'jane@example.com', seq: 'seq-1' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/invalid or expired/i)
    expect(upsertPayload).toBeNull()
  })

  it('rejects a forged/unsigned token', async () => {
    const forged = Buffer.from(JSON.stringify({ email: 'jane@example.com' })).toString('base64url')
    const res = await unsubscribeRequest({ token: forged })

    expect(res.status).toBe(400)
    expect(upsertPayload).toBeNull()
  })

  it('accepts a validly-signed token and suppresses the real email it was issued for', async () => {
    const token = signToken({ email: 'jane@example.com', seq: 'seq-1' })
    const res = await unsubscribeRequest({ token })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.unsubscribed).toBe('jane@example.com')
    expect(upsertPayload).toEqual(expect.objectContaining({ email: 'jane@example.com', source: 'seq-1' }))
  })

  it('buildSequenceUnsubscribeUrl produces a token this route actually accepts', async () => {
    const url = buildSequenceUnsubscribeUrl('https://app.example.com', 'Jane@Example.com', 'seq-2')
    const token = new URL(url).searchParams.get('token')!

    const res = await unsubscribeRequest({ token })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.unsubscribed).toBe('jane@example.com')
  })
})
