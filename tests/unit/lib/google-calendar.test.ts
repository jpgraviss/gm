import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock encryption module
vi.mock('@/lib/encryption', () => ({
  encrypt: (v: string) => `encrypted:${v}`,
  decrypt: (v: string) => v.startsWith('encrypted:') ? v.slice(10) : v,
}))

// Mock supabase for the dynamic import in getValidAccessToken
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: () => ({ update: mockUpdate }),
  }),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  getValidAccessToken,
  computeAvailableSlots,
  getGoogleAuthUrl,
  type CalendarSettings,
  type Booking,
} from '@/lib/google-calendar'

function makeSettings(overrides: Partial<CalendarSettings> = {}): CalendarSettings {
  return {
    id: 'cal-1',
    user_email: 'test@example.com',
    user_name: 'Test User',
    slug: 'test-user',
    title: 'Book a Call',
    description: null,
    duration: 30,
    buffer: 0,
    timezone: 'America/New_York',
    available_days: [1, 2, 3, 4, 5], // Mon-Fri
    available_start: '09:00',
    available_end: '17:00',
    google_refresh_token: null,
    google_access_token: null,
    google_token_expiry: null,
    active: true,
    ...overrides,
  }
}

describe('getValidAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no refresh token exists', async () => {
    const settings = makeSettings({ google_refresh_token: null })
    const token = await getValidAccessToken(settings)
    expect(token).toBeNull()
  })

  it('returns cached access token if not expired (with 2-min buffer)', async () => {
    const futureExpiry = new Date(Date.now() + 300_000).toISOString() // 5 min from now
    const settings = makeSettings({
      google_refresh_token: 'encrypted:refresh-tok',
      google_access_token: 'encrypted:access-tok',
      google_token_expiry: futureExpiry,
    })
    const token = await getValidAccessToken(settings)
    expect(token).toBe('access-tok')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refreshes token when access token is expired', async () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString() // 1 min ago
    const settings = makeSettings({
      google_refresh_token: 'encrypted:refresh-tok',
      google_access_token: 'encrypted:old-access',
      google_token_expiry: pastExpiry,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access-tok' }),
    })

    const token = await getValidAccessToken(settings)
    expect(token).toBe('new-access-tok')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('refreshes token when no access token exists', async () => {
    const settings = makeSettings({
      google_refresh_token: 'encrypted:refresh-tok',
      google_access_token: null,
      google_token_expiry: null,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'fresh-tok' }),
    })

    const token = await getValidAccessToken(settings)
    expect(token).toBe('fresh-tok')
  })

  it('returns null when token refresh fails', async () => {
    const settings = makeSettings({
      google_refresh_token: 'encrypted:refresh-tok',
      google_access_token: null,
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('invalid_grant'),
    })

    const token = await getValidAccessToken(settings)
    expect(token).toBeNull()
  })
})

describe('getGoogleAuthUrl', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/calendar/callback'
  })

  it('generates a valid Google OAuth URL with correct params', () => {
    const url = getGoogleAuthUrl('my-state')
    expect(url).toContain('accounts.google.com/o/oauth2')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('state=my-state')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
    expect(url).toContain('scope=')
  })
})

describe('computeAvailableSlots', () => {
  // Use a known future Monday for deterministic tests
  const futureMonday = '2027-01-04' // A Monday

  it('returns slots for an available weekday', () => {
    const settings = makeSettings({ duration: 60, buffer: 0 })
    const slots = computeAvailableSlots(futureMonday, settings, [], [])
    // 9am-5pm with 60-min slots = 8 slots
    expect(slots).toHaveLength(8)
    expect(slots[0]).toEqual({ start: '09:00', end: '10:00', label: '9:00 AM' })
    expect(slots[7]).toEqual({ start: '16:00', end: '17:00', label: '4:00 PM' })
  })

  it('returns no slots for unavailable days (weekends)', () => {
    const settings = makeSettings({ available_days: [1, 2, 3, 4, 5] })
    // 2027-01-03 is a Sunday
    const slots = computeAvailableSlots('2027-01-03', settings, [], [])
    expect(slots).toHaveLength(0)
  })

  it('returns no slots for past dates', () => {
    const settings = makeSettings()
    const slots = computeAvailableSlots('2020-01-01', settings, [], [])
    expect(slots).toHaveLength(0)
  })

  it('excludes slots blocked by existing bookings', () => {
    const settings = makeSettings({ duration: 60, buffer: 0 })
    const bookings: Pick<Booking, 'start_time' | 'end_time'>[] = [
      { start_time: '10:00', end_time: '11:00' },
    ]
    const slots = computeAvailableSlots(futureMonday, settings, [], bookings)
    // 10:00-11:00 should be blocked, leaving 7 slots
    expect(slots).toHaveLength(7)
    expect(slots.find(s => s.start === '10:00')).toBeUndefined()
  })

  it('excludes slots blocked by Google busy times', () => {
    const settings = makeSettings({ duration: 60, buffer: 0, timezone: 'UTC' })
    const googleBusy = [
      { start: `${futureMonday}T09:00:00Z`, end: `${futureMonday}T10:00:00Z` },
    ]
    const slots = computeAvailableSlots(futureMonday, settings, googleBusy, [])
    expect(slots.find(s => s.start === '09:00')).toBeUndefined()
  })

  it('applies buffer around existing bookings', () => {
    const settings = makeSettings({ duration: 30, buffer: 15 })
    const bookings: Pick<Booking, 'start_time' | 'end_time'>[] = [
      { start_time: '10:00', end_time: '10:30' },
    ]
    const slots = computeAvailableSlots(futureMonday, settings, [], bookings)
    // With 15-min buffer: 9:45-10:45 is blocked
    // The 09:30-10:00 slot overlaps the buffer start (10:00-15=9:45)
    expect(slots.find(s => s.start === '09:30')).toBeUndefined()
    expect(slots.find(s => s.start === '10:00')).toBeUndefined()
    expect(slots.find(s => s.start === '10:30')).toBeUndefined()
  })

  it('generates correct labels in 12-hour format', () => {
    const settings = makeSettings({ duration: 60 })
    const slots = computeAvailableSlots(futureMonday, settings, [], [])
    const labels = slots.map(s => s.label)
    expect(labels).toContain('9:00 AM')
    expect(labels).toContain('12:00 PM')
    expect(labels).toContain('4:00 PM')
  })
})
