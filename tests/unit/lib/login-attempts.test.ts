import { describe, it, expect, beforeEach, vi } from 'vitest'

// Durable (cross-instance) account lockout — migration
// 20260805140000_add_rate_limit_counters.sql. These tests pin the two
// properties the fix exists for: the counter survives an instance that has
// no local memory of the attempts, and a database outage degrades to the
// old in-process behavior rather than to no protection at all.

type CounterRow = { count: number; reset_at: string } | null
type CounterResult = { data: CounterRow; error: { message: string } | null }

const rpc = vi.fn(async () => ({ data: 1, error: null }))
const maybeSingle = vi.fn<() => Promise<CounterResult>>(async () => ({ data: null, error: null }))
const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
let clientThrows = false

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => {
    if (clientThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
    return {
      rpc,
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle }) }),
        delete: del,
      }),
    }
  },
}))

import {
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  __resetLocalAttempts,
} from '@/lib/login-attempts'

/** Shape of a live, unexpired counter row for `n` attempts. */
function row(n: number, msFromNow = 60_000): CounterResult {
  return { data: { count: n, reset_at: new Date(Date.now() + msFromNow).toISOString() }, error: null }
}

beforeEach(() => {
  __resetLocalAttempts()
  clientThrows = false
  rpc.mockClear()
  del.mockClear()
  maybeSingle.mockReset()
  maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('isLockedOut', () => {
  it('never locks out when the setting is "unlimited"', async () => {
    maybeSingle.mockResolvedValue(row(999))
    expect(await isLockedOut('a@b.com', 'unlimited')).toBe(false)
    // Should not even query — "unlimited" is a pure short-circuit.
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('returns false when no counter row exists', async () => {
    expect(await isLockedOut('a@b.com', 5)).toBe(false)
  })

  it('locks out on a stored count from another instance, with no local state', async () => {
    // The whole point of the migration: this process never saw the attempts.
    maybeSingle.mockResolvedValue(row(5))
    expect(await isLockedOut('a@b.com', 5)).toBe(true)
  })

  it('does not lock out below the threshold', async () => {
    maybeSingle.mockResolvedValue(row(4))
    expect(await isLockedOut('a@b.com', 5)).toBe(false)
  })

  it('treats an elapsed window as not locked out even at a high count', async () => {
    maybeSingle.mockResolvedValue(row(50, -1_000))
    expect(await isLockedOut('a@b.com', 5)).toBe(false)
  })

  it('fails open on a database error rather than locking everyone out', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await isLockedOut('a@b.com', 5)).toBe(false)
  })

  it('still enforces the in-process layer when the database is unreachable', async () => {
    clientThrows = true
    for (let i = 0; i < 3; i++) await recordFailedAttempt('a@b.com')
    expect(await isLockedOut('a@b.com', 3)).toBe(true)
    // ...and the DB was never successfully consulted on any of those calls.
    expect(rpc).not.toHaveBeenCalled()
  })

  it('normalizes case and whitespace so lockout cannot be bypassed', async () => {
    for (let i = 0; i < 3; i++) await recordFailedAttempt('  A@B.com ')
    expect(await isLockedOut('a@b.com', 3)).toBe(true)
  })
})

describe('recordFailedAttempt', () => {
  it('increments the durable counter through the atomic RPC', async () => {
    await recordFailedAttempt('a@b.com')
    expect(rpc).toHaveBeenCalledWith('increment_rate_limit_counter', {
      p_key: 'login:a@b.com',
      p_window_seconds: 1800,
    })
  })

  it('records locally even when the RPC throws', async () => {
    rpc.mockRejectedValueOnce(new Error('network'))
    await expect(recordFailedAttempt('a@b.com')).resolves.toBeUndefined()
    expect(await isLockedOut('a@b.com', 1)).toBe(true)
  })
})

describe('clearAttempts', () => {
  it('drops both the local entry and the stored row', async () => {
    await recordFailedAttempt('a@b.com')
    await clearAttempts('a@b.com')
    expect(del).toHaveBeenCalled()
    // Local layer cleared: with no stored row, a fresh check is clean.
    expect(await isLockedOut('a@b.com', 1)).toBe(false)
  })

  it('does not throw when the delete fails', async () => {
    clientThrows = true
    await expect(clearAttempts('a@b.com')).resolves.toBeUndefined()
  })
})
