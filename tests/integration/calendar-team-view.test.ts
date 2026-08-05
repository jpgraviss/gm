import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// GET /api/calendar/team — the shared multi-staff schedule.
//
// The security-relevant behavior here is the split decided in the route's
// header comment: every Team Member may see WHEN a colleague is busy, but
// guest contact detail (email/phone/notes) is stripped server-side for other
// people's bookings unless the caller is Dept Manager+. AUDIT #231 (the
// personal iCal feed leaking every colleague's guest details) is the reason
// that split has to be enforced on the server, not in the UI.

type AuthUser = {
  userId: string
  email: string
  name: string
  role: string
  unit: string
  isAdmin: boolean
}

let authUser: AuthUser | null = null
let ownCalRow: { slug: string } | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let legacyRows: any[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let typeRows: any[] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function thenableChain(result: { data: any; error: unknown }, extra?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  const passthrough = () => chain
  for (const m of ['select', 'gte', 'lte', 'neq', 'eq', 'not', 'or', 'lt', 'order', 'limit']) {
    chain[m] = passthrough
  }
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  Object.assign(chain, extra ?? {})
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'calendar_settings') {
      // Two different reads hit this table: the caller's own slug
      // (.eq().maybeSingle()) and the timezone fallback (.not().limit()).
      return thenableChain(
        { data: [{ timezone: 'America/Chicago' }], error: null },
        { maybeSingle: () => Promise.resolve({ data: ownCalRow, error: null }) },
      )
    }
    if (table === 'bookings') return thenableChain({ data: legacyRows, error: null })
    if (table === 'booking_type_bookings') return thenableChain({ data: typeRows, error: null })
    throw new Error(`unexpected table ${table}`)
  }),
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))

vi.mock('@/lib/rbac', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/rbac')>()
  return { ...actual, getAuthUser: vi.fn(() => Promise.resolve(authUser)) }
})

import { GET } from '@/app/api/calendar/team/route'

function teamRequest(query = 'start=2026-08-05') {
  return GET(new NextRequest(new URL(`http://localhost/api/calendar/team?${query}`)))
}

function user(role: string, email: string, isAdmin = false): AuthUser {
  return { userId: 'tm-1', email, name: 'Test User', role, unit: 'Delivery', isAdmin }
}

describe('GET /api/calendar/team', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser = user('Team Member', 'jamie@gravissmarketing.com')
    ownCalRow = { slug: 'jamie' }
    legacyRows = [
      {
        id: 'bk-own', calendar_slug: 'jamie', date: '2026-08-05',
        start_time: '10:00', end_time: '10:30', status: 'confirmed',
        timezone: 'America/Chicago', client_name: 'Acme Corp',
        client_email: 'buyer@acme.com', client_company: 'Acme', notes: 'wants pricing',
        meet_link: null, subscription_id: null,
      },
      {
        id: 'bk-colleague', calendar_slug: 'alex', date: '2026-08-05',
        start_time: '09:00', end_time: '09:30', status: 'confirmed',
        timezone: 'America/Chicago', client_name: 'Globex',
        client_email: 'cfo@globex.com', client_company: 'Globex', notes: 'renewal risk',
        meet_link: null, subscription_id: null,
      },
      {
        id: 'bk-imported', calendar_slug: 'imported', date: '2026-08-05',
        start_time: '13:00', end_time: '14:00', status: 'confirmed',
        timezone: 'America/Chicago', client_name: 'Offsite',
        client_email: null, client_company: null, notes: null,
        meet_link: null, subscription_id: 'sub-1',
      },
    ]
    typeRows = [
      {
        id: 'tb-unassigned', date: '2026-08-05', start_time: '15:00', end_time: '15:30',
        status: 'confirmed', guest_name: 'Initech', guest_email: 'ops@initech.com',
        guest_company: 'Initech', notes: 'intro call', meet_link: null,
        booking_types: { name: 'Discovery', slug: 'discovery', color: '#015035', owner_calendar_slug: null },
      },
    ]
  })

  it('rejects an unauthenticated caller', async () => {
    authUser = null
    expect((await teamRequest()).status).toBe(401)
  })

  it('rejects a role below Team Member', async () => {
    authUser = user('Contractor', 'contractor@example.com')
    expect((await teamRequest()).status).toBe(403)
  })

  it('rejects a malformed or missing date range', async () => {
    expect((await teamRequest('')).status).toBe(400)
    expect((await teamRequest('start=05-08-2026')).status).toBe(400)
    expect((await teamRequest('start=2026-08-05&end=2026-08-04')).status).toBe(400)
    expect((await teamRequest('start=2026-01-01&end=2026-12-31')).status).toBe(400)
  })

  it('lets a Team Member see every colleague’s busy time', async () => {
    const res = await teamRequest()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.map((e: { id: string }) => e.id)).toEqual(
      expect.arrayContaining(['bk-own', 'bk-colleague', 'bk-imported', 'tb-unassigned']),
    )
  })

  it('strips a colleague’s guest details for a plain Team Member but keeps their own', async () => {
    const body = await (await teamRequest()).json()
    const own = body.find((e: { id: string }) => e.id === 'bk-own')
    const colleague = body.find((e: { id: string }) => e.id === 'bk-colleague')

    expect(own.details_visible).toBe(true)
    expect(own.guest_email).toBe('buyer@acme.com')
    expect(own.notes).toBe('wants pricing')

    // Busy time and client identity stay (that's what prevents the
    // collision); contact detail and notes do not.
    expect(colleague.title).toBe('Globex')
    expect(colleague.start_time).toBe('09:00')
    expect(colleague.details_visible).toBe(false)
    expect(colleague.guest_email).toBeNull()
    expect(colleague.notes).toBeNull()
  })

  it('gives Dept Manager and above the guest details on every booking', async () => {
    authUser = user('Dept Manager', 'boss@gravissmarketing.com')
    ownCalRow = null
    const body = await (await teamRequest()).json()
    const colleague = body.find((e: { id: string }) => e.id === 'bk-colleague')
    expect(colleague.details_visible).toBe(true)
    expect(colleague.guest_email).toBe('cfo@globex.com')
    expect(colleague.notes).toBe('renewal risk')
  })

  it('reports unattributable rows as unowned instead of assigning them to someone', async () => {
    const body = await (await teamRequest()).json()
    // The 'imported' bucket names no person...
    expect(body.find((e: { id: string }) => e.id === 'bk-imported').owner_slug).toBeNull()
    // ...and neither does a booking type with no owner_calendar_slug (#699).
    const unassigned = body.find((e: { id: string }) => e.id === 'tb-unassigned')
    expect(unassigned.owner_slug).toBeNull()
    expect(unassigned.type_name).toBe('Discovery')
    // An unowned booking is nobody's "own" booking, so its guest details are
    // redacted for a non-manager rather than defaulting to visible.
    expect(unassigned.details_visible).toBe(false)
    expect(unassigned.guest_email).toBeNull()
  })

  it('returns entries sorted by date then start time', async () => {
    const body = await (await teamRequest()).json()
    const times = body.map((e: { start_time: string }) => e.start_time)
    expect(times).toEqual([...times].sort())
  })
})
