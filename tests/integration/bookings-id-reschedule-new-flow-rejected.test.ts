import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #607 — {status:'rescheduled'} against a booking_type_bookings row
// (new-flow booking) skipped #571's conflict-checked reschedule logic
// entirely and would violate that table's own status CHECK constraint
// (confirmed/cancelled/completed only), 500ing instead of a clear error.

let updateCalled: boolean

function makeTable(table: string) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  if (table === 'bookings') {
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'not found' } }))
  } else {
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'ntb-1', status: 'confirmed' }, error: null }))
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 'ntb-1', status: 'confirmed' }, error: null }))
  }
  chain.update = vi.fn(() => {
    updateCalled = true
    return chain
  })
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => makeTable(table)),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ email: 'jamie@gravissmarketing.com' }),
}))

import { PATCH } from '@/app/api/bookings/[id]/route'

function patchBooking(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/bookings/ntb-1'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id: 'ntb-1' }) })
}

describe('PATCH /api/bookings/[id] — rejects rescheduled for new-flow bookings (#607)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalled = false
  })

  it('rejects status:"rescheduled" against a booking_type_bookings row with a clear error', async () => {
    const res = await patchBooking({ status: 'rescheduled' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/not supported/i)
    expect(updateCalled).toBe(false)
  })

  it('still allows a real status update against a booking_type_bookings row', async () => {
    const res = await patchBooking({ status: 'cancelled' })

    expect(res.status).toBe(200)
    expect(updateCalled).toBe(true)
  })
})
