import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Broadcast delivery stats must be incremented atomically.
 *
 * AUDIT #769 — this route did SELECT total_opened -> +1 -> UPDATE. Resend
 * posts one webhook per recipient per event, so a large broadcast lands
 * thousands of these on the same `broadcasts` row concurrently and the
 * increments overwrite each other. The reported numbers came out
 * systematically low, always understating the campaign.
 *
 * Two things are worth pinning: that the atomic RPC is what's called, and
 * that the old path still runs if the RPC is missing — because the
 * migration adding it is applied by hand, so the code ships first.
 */

let rpcCalls: Array<{ fn: string; args: unknown }> = []
let rpcError: { message: string } | null = null
let updates: Array<{ table: string; payload: Record<string, unknown> }> = []
let selectedRow: Record<string, unknown> | null = null

const mockDb = {
  rpc: vi.fn((fn: string, args: unknown) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve({ data: null, error: rpcError })
  }),
  from: vi.fn((table: string) => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: selectedRow, error: null }))
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: selectedRow, error: null }))
    chain.update = vi.fn((payload: Record<string, unknown>) => {
      updates.push({ table, payload })
      const u: Record<string, unknown> = {}
      u.eq = vi.fn(() => Promise.resolve({ error: null }))
      return u
    })
    chain.upsert = vi.fn(() => Promise.resolve({ error: null }))
    chain.insert = vi.fn(() => Promise.resolve({ error: null }))
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))
vi.mock('@/lib/automations-engine', () => ({ fireAutomations: vi.fn() }))
vi.mock('@/lib/webhook-verify', () => ({ verifyResendSignature: () => true }))

import { POST } from '@/app/api/sequences/webhooks/route'

function fireEvent(type: string) {
  const body = JSON.stringify({
    type,
    data: {
      email_id: 'em-1',
      to: ['client@example.com'],
      headers: [
        { name: 'X-Broadcast-Id', value: 'bc-1' },
        { name: 'X-Recipient-Id', value: 'rcp-1' },
      ],
    },
  })
  return POST(new NextRequest(new URL('http://localhost/api/sequences/webhooks'), {
    method: 'POST',
    body,
  }))
}

describe('broadcast counters increment atomically', () => {
  beforeEach(() => {
    rpcCalls = []
    updates = []
    rpcError = null
    selectedRow = { total_opened: 7 }
    process.env.RESEND_WEBHOOK_SECRET = 'test-secret'
  })

  it.each([
    ['email.delivered', 'total_delivered'],
    ['email.opened', 'total_opened'],
    ['email.clicked', 'total_clicked'],
    ['email.bounced', 'total_bounced'],
    ['email.complained', 'total_unsubscribed'],
  ])('routes %s through the atomic RPC as %s', async (event, column) => {
    await fireEvent(event)

    expect(rpcCalls).toContainEqual({
      fn: 'increment_broadcast_counter',
      args: { p_id: 'bc-1', p_column: column },
    })
    // The whole point: no read-modify-write on the broadcasts row.
    expect(updates.filter(u => u.table === 'broadcasts')).toEqual([])
  })

  it('falls back to the old path when the RPC is missing', async () => {
    // The migration is applied by hand, so the code can be live before the
    // function exists. Losing the count entirely would be a regression on
    // today's behaviour; racing is not.
    rpcError = { message: 'function increment_broadcast_counter does not exist' }

    await fireEvent('email.opened')

    const broadcastUpdates = updates.filter(u => u.table === 'broadcasts')
    expect(broadcastUpdates).toHaveLength(1)
    expect(broadcastUpdates[0].payload).toEqual({ total_opened: 8 })
  })

  it('still marks the recipient row regardless of which path ran', async () => {
    await fireEvent('email.opened')
    const recipientUpdate = updates.find(u => u.table === 'broadcast_recipients')
    expect(recipientUpdate?.payload.status).toBe('opened')
    expect(recipientUpdate?.payload.opened_at).toEqual(expect.any(String))
  })
})
