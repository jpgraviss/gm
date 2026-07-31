import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT #571 — PATCH /api/bookings/[id]'s reschedule branch previously
// deleted the old Google event and wrote the new date/time straight to the
// DB with none of POST /api/bookings' conflict-detection: no re-check
// against business hours, no re-check against other confirmed bookings, no
// live Google Calendar busy check. This asserts the fix reuses the same
// computeAvailableSlots the slot picker and POST already use, and that a
// rejected reschedule never mutates the booking or deletes its Google event.

const CALENDAR_SETTINGS = {
  id: 'cal-1',
  user_email: 'owner@example.com',
  user_name: 'Jonathan Graviss',
  slug: 'jonathan',
  title: 'Strategy Call',
  description: null,
  duration: 30,
  buffer: 0,
  timezone: 'America/Chicago',
  available_days: [1, 2, 3, 4, 5],
  available_start: '09:00',
  available_end: '17:00',
  google_refresh_token: null,
  google_access_token: null,
  google_token_expiry: null,
  google_sync_token: null,
  active: true,
}

// Monday, far enough in the future that "today"/lead-time cutoffs never
// affect the test regardless of when it's actually run.
const FUTURE_MONDAY = '2027-06-07'

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk-1',
    calendar_slug: 'jonathan',
    client_name: 'Jane Client',
    client_email: 'jane@example.com',
    date: '2027-05-31',
    start_time: '10:00',
    end_time: '10:30',
    status: 'confirmed',
    google_event_id: null,
    notes: null,
    timezone: 'America/Chicago',
    calendar_settings: CALENDAR_SETTINGS,
    ...overrides,
  }
}

let bookingSelectQueue: { data: unknown; error: unknown }[]
let updateResult: { data: unknown; error: unknown }
let capturedUpdatePayload: Record<string, unknown> | null
let deleteEventCalled: boolean
let createEventCalled: boolean

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'lt', 'gt', 'limit']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

const mockDb = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'owner@example.com' } }, error: null }) },
  from: vi.fn((table: string) => {
    if (table === 'calendar_settings') {
      return { select: vi.fn(() => makeChain({ data: { slug: 'jonathan' }, error: null })) }
    }
    if (table === 'bookings') {
      return {
        select: vi.fn(() => makeChain(bookingSelectQueue.shift() ?? { data: null, error: null })),
        update: vi.fn((payload: Record<string, unknown>) => {
          capturedUpdatePayload = payload
          return makeChain(updateResult)
        }),
      }
    }
    return { select: vi.fn(() => makeChain({ data: null, error: null })) }
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/google-calendar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/google-calendar')>()
  return {
    ...actual,
    // computeAvailableSlots is left as the REAL implementation — that's
    // the exact logic this fix is supposed to now enforce.
    getValidAccessToken: vi.fn().mockResolvedValue(null),
    getGoogleBusySlots: vi.fn(() => { throw new Error('should not be called when accessToken is null') }),
    deleteGoogleEvent: vi.fn(() => { deleteEventCalled = true; return Promise.resolve() }),
    createGoogleEvent: vi.fn(() => { createEventCalled = true; return Promise.resolve({ eventId: null, meetLink: null }) }),
  }
})

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

import { PATCH } from '@/app/api/bookings/[id]/route'

function reschedule(body: Record<string, unknown>) {
  const req = new NextRequest(new URL('http://localhost/api/bookings/bk-1'), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer faketoken' },
    body: JSON.stringify({ status: 'rescheduled', ...body }),
  })
  return PATCH(req, { params: Promise.resolve({ id: 'bk-1' }) })
}

describe('PATCH /api/bookings/[id] — reschedule conflict detection (#571)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedUpdatePayload = null
    deleteEventCalled = false
    createEventCalled = false
    updateResult = { data: { id: 'bk-1', date: FUTURE_MONDAY, start_time: '10:00', end_time: '10:30' }, error: null }
  })

  it('rejects a reschedule to a time outside business hours, without touching the Google event or the DB row', async () => {
    const booking = bookingRow()
    bookingSelectQueue = [
      { data: booking, error: null }, // ownership-check fetch
      { data: booking, error: null }, // reschBooking fetch
    ]

    const res = await reschedule({ newDate: FUTURE_MONDAY, newStartTime: '20:00', newEndTime: '20:30' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/outside available hours/i)
    expect(capturedUpdatePayload).toBeNull()
    expect(deleteEventCalled).toBe(false)
    expect(createEventCalled).toBe(false)
  })

  it('rejects a reschedule onto a slot another confirmed booking already occupies', async () => {
    const booking = bookingRow()
    bookingSelectQueue = [
      { data: booking, error: null },
      { data: booking, error: null },
      { data: [{ start_time: '10:00', end_time: '10:30' }], error: null }, // existingBookingsForNewDate — someone else, 10:00-10:30
    ]

    const res = await reschedule({ newDate: FUTURE_MONDAY, newStartTime: '10:00', newEndTime: '10:30' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/outside available hours or no longer available/i)
    expect(capturedUpdatePayload).toBeNull()
  })

  it('does not conflict with its own current (pre-reschedule) slot when moving to a genuinely free time', async () => {
    const booking = bookingRow()
    bookingSelectQueue = [
      { data: booking, error: null },
      { data: booking, error: null },
      { data: [], error: null }, // existingBookingsForNewDate — nothing else booked
      { data: [], error: null }, // reschConflict — no race conflict
    ]

    const res = await reschedule({ newDate: FUTURE_MONDAY, newStartTime: '10:00', newEndTime: '10:30' })

    expect(res.status).toBe(200)
    expect(capturedUpdatePayload).toEqual(expect.objectContaining({
      date: FUTURE_MONDAY, start_time: '10:00', end_time: '10:30', status: 'confirmed',
    }))
  })

  it('rejects a race conflict caught at the final re-check, without writing the new time', async () => {
    const booking = bookingRow()
    bookingSelectQueue = [
      { data: booking, error: null },
      { data: booking, error: null },
      { data: [], error: null }, // existingBookingsForNewDate — clear at the first check
      { data: [{ id: 'other-bk' }], error: null }, // reschConflict — someone else claimed it a moment later
    ]

    const res = await reschedule({ newDate: FUTURE_MONDAY, newStartTime: '10:00', newEndTime: '10:30' })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toMatch(/no longer available/i)
    expect(capturedUpdatePayload).toBeNull()
  })
})
