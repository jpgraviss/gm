import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #610 — this route never read a sequence's thread_mode and always
// treated messageIds[0] as "the" Gmail thread. For an unthreaded sequence
// (thread_mode: false) each step sends as its own standalone Gmail thread,
// so a reply to step 2+ was never checked at all — only messageIds[0]'s own
// thread was ever polled. Asserts the fix: threaded sequences keep checking
// only messageIds[0], but unthreaded sequences check every step's own
// thread and detect a reply wherever it actually landed.

process.env.CRON_SECRET = 'test-secret'

let enrollmentsResult: { data: Record<string, unknown>[] | null; error: null }
let sequenceRowsResult: { data: Record<string, unknown>[] | null }
let repsResult: { data: Record<string, unknown>[] | null }
let updatedEnrollmentIds: string[]
let insertedActivities: Record<string, unknown>[]
let rpcCalls: unknown[][]

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'sequence_enrollments') {
      return {
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.not = vi.fn(() => Promise.resolve(enrollmentsResult))
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn((k: string, v: unknown) => {
            if (k === 'id') chain._id = v
            return chain
          })
          chain.select = vi.fn(() => chain)
          chain.maybeSingle = vi.fn(() => {
            const id = chain._id as string
            updatedEnrollmentIds.push(id)
            return Promise.resolve({ data: { id }, error: null })
          })
          return chain
        }),
      }
    }
    if (table === 'sequences') {
      return {
        select: vi.fn((cols: string) => {
          const chain: Record<string, unknown> = {}
          if (cols.includes('thread_mode')) {
            chain.in = vi.fn(() => Promise.resolve(sequenceRowsResult))
          } else {
            chain.eq = vi.fn(() => chain)
            chain.single = vi.fn(() => Promise.resolve({ data: { enrolled_count: 10, name: 'Test Seq' } }))
          }
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => Promise.resolve({ error: null }))
          return chain
        }),
      }
    }
    if (table === 'sequence_activities') {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertedActivities.push(payload)
          return Promise.resolve({ error: null })
        }),
        select: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => Promise.resolve({ data: [] }))
          return chain
        }),
      }
    }
    if (table === 'team_members') {
      return { select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve(repsResult)) })) }
    }
    if (table === 'crm_contacts') {
      return { update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) }
    }
    return { select: vi.fn() }
  }),
  rpc: vi.fn((...args: unknown[]) => { rpcCalls.push(args); return Promise.resolve({ error: null }) }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))

import { POST } from '@/app/api/sequences/reply-check/route'

function callReplyCheck() {
  const req = new NextRequest(new URL('http://localhost/api/sequences/reply-check'), {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret' },
  })
  return POST(req)
}

function mockGmailThreads(threadsById: Record<string, { messages: unknown[] } | null>) {
  return vi.fn((url: string) => {
    const match = url.match(/threads\/([^?]+)/)
    const id = match?.[1] ?? ''
    const thread = threadsById[id]
    if (!thread) return Promise.resolve({ ok: false })
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ id, messages: thread.messages }) })
  })
}

describe('POST /api/sequences/reply-check — thread_mode awareness (#610)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updatedEnrollmentIds = []
    insertedActivities = []
    rpcCalls = []
    repsResult = { data: [{ id: 'rep-1', gmail_access_token: 'tok', gmail_token_expires_at: null }] }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('threaded sequence: checks only messageIds[0] and detects a reply from the growing thread', async () => {
    enrollmentsResult = {
      data: [{
        id: 'enr-1', sequence_id: 'seq-threaded', contact_email: 'a@example.com', contact_name: 'A',
        contact_id: null, company: 'Acme', message_ids: ['m1', 'm2'], assigned_rep_id: 'rep-1',
        current_step: 1, ab_variant: null,
      }],
      error: null,
    }
    sequenceRowsResult = { data: [{ id: 'seq-threaded', thread_mode: true }] }
    vi.stubGlobal('fetch', mockGmailThreads({
      m1: { messages: [{ id: 'm1' }, { id: 'm2' }, { id: 'reply1' }] }, // 3 messages, we sent 2
    }))

    const res = await callReplyCheck()
    const json = await res.json()

    expect(json.replies).toBe(1)
    expect(updatedEnrollmentIds).toEqual(['enr-1'])
    expect(insertedActivities[0]).toEqual(expect.objectContaining({
      metadata: { thread_id: 'm1', thread_message_count: 3 },
    }))
  })

  it('unthreaded sequence: a reply to step 2 (not step 1) is still detected', async () => {
    enrollmentsResult = {
      data: [{
        id: 'enr-2', sequence_id: 'seq-unthreaded', contact_email: 'b@example.com', contact_name: 'B',
        contact_id: null, company: 'Acme', message_ids: ['m1', 'm2'], assigned_rep_id: 'rep-1',
        current_step: 1, ab_variant: null,
      }],
      error: null,
    }
    sequenceRowsResult = { data: [{ id: 'seq-unthreaded', thread_mode: false }] }
    vi.stubGlobal('fetch', mockGmailThreads({
      m1: { messages: [{ id: 'm1' }] },                    // step 1's own thread: no reply
      m2: { messages: [{ id: 'm2' }, { id: 'reply2' }] },  // step 2's own thread: a reply
    }))

    const res = await callReplyCheck()
    const json = await res.json()

    expect(json.replies).toBe(1)
    expect(updatedEnrollmentIds).toEqual(['enr-2'])
    expect(insertedActivities[0]).toEqual(expect.objectContaining({
      metadata: { thread_id: 'm2', thread_message_count: 2 },
    }))
  })

  it('unthreaded sequence: no reply anywhere means no write at all', async () => {
    enrollmentsResult = {
      data: [{
        id: 'enr-3', sequence_id: 'seq-unthreaded', contact_email: 'c@example.com', contact_name: 'C',
        contact_id: null, company: 'Acme', message_ids: ['m1', 'm2'], assigned_rep_id: 'rep-1',
        current_step: 1, ab_variant: null,
      }],
      error: null,
    }
    sequenceRowsResult = { data: [{ id: 'seq-unthreaded', thread_mode: false }] }
    vi.stubGlobal('fetch', mockGmailThreads({
      m1: { messages: [{ id: 'm1' }] },
      m2: { messages: [{ id: 'm2' }] },
    }))

    const res = await callReplyCheck()
    const json = await res.json()

    expect(json.replies).toBe(0)
    expect(updatedEnrollmentIds).toEqual([])
    expect(insertedActivities).toEqual([])
  })
})
