// ─── Google Calendar API helpers (server-side only) ──────────────────────────

import { encrypt, decrypt } from './encryption'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR  = 'https://www.googleapis.com/calendar/v3'

export interface CalendarSettings {
  id: string
  user_email: string
  user_name: string
  slug: string
  title: string
  description: string | null
  duration: number
  buffer: number
  timezone: string
  available_days: number[]
  available_start: string
  available_end: string
  google_refresh_token: string | null
  google_access_token: string | null
  google_token_expiry: string | null
  active: boolean
}

export interface Booking {
  id: string
  calendar_slug: string
  client_name: string
  client_email: string
  client_company: string | null
  client_phone: string | null
  notes: string | null
  date: string
  start_time: string
  end_time: string
  timezone: string
  status: string
  google_event_id: string | null
  meet_link: string | null
  created_at: string
}

export interface TimeSlot {
  start: string  // "HH:MM"
  end: string    // "HH:MM"
  label: string  // "9:00 AM"
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(state: string): string {
  const clientId    = process.env.GOOGLE_CLIENT_ID!
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    access_type:   'offline',
    prompt:        'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!,
      grant_type:    'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token:  refreshToken,
      client_id:      process.env.GOOGLE_CLIENT_ID!,
      client_secret:  process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:     'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

// ── Token management ──────────────────────────────────────────────────────────

export async function getValidAccessToken(settings: CalendarSettings): Promise<string | null> {
  if (!settings.google_refresh_token) return null

  // Decrypt tokens read from the database
  const decryptedAccessToken = settings.google_access_token ? decrypt(settings.google_access_token) : null
  const decryptedRefreshToken = decrypt(settings.google_refresh_token)

  // If token is still valid (with 2-min buffer), use it
  if (decryptedAccessToken && settings.google_token_expiry) {
    const expiry = new Date(settings.google_token_expiry)
    if (expiry.getTime() > Date.now() + 120_000) {
      return decryptedAccessToken
    }
  }

  // Refresh
  try {
    const { createServiceClient } = await import('./supabase')
    const db  = createServiceClient()
    const token = await refreshAccessToken(decryptedRefreshToken)
    const expiry = new Date(Date.now() + 3600 * 1000).toISOString()
    await db.from('calendar_settings').update({
      google_access_token: encrypt(token),
      google_token_expiry: expiry,
    }).eq('slug', settings.slug)
    return token
  } catch {
    return null
  }
}

// ── Free/busy from Google ─────────────────────────────────────────────────────

interface BusySlot { start: string; end: string }

export async function getGoogleBusySlots(
  accessToken: string,
  date: string,           // "YYYY-MM-DD"
  timezone: string,
): Promise<BusySlot[]> {
  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd   = new Date(`${date}T23:59:59`)

  const res = await fetch(`${GOOGLE_CALENDAR}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin:  dayStart.toISOString(),
      timeMax:  dayEnd.toISOString(),
      timeZone: timezone,
      items:    [{ id: 'primary' }],
    }),
  })

  if (!res.ok) return []
  const data = await res.json()
  return (data.calendars?.primary?.busy ?? []).map((b: BusySlot) => ({
    start: b.start,
    end:   b.end,
  }))
}

// ── Create Google Calendar event ──────────────────────────────────────────────

export async function createGoogleEvent(
  accessToken: string,
  params: {
    summary:      string
    description:  string
    dateTimeStart: string   // ISO 8601 e.g. "2026-03-10T14:00:00"
    dateTimeEnd:   string
    timezone:      string
    attendeeEmail: string
    attendeeName:  string
  },
): Promise<{ eventId: string; meetLink: string | null }> {
  const res = await fetch(
    `${GOOGLE_CALENDAR}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary:     params.summary,
        description: params.description,
        start: { dateTime: params.dateTimeStart, timeZone: params.timezone },
        end:   { dateTime: params.dateTimeEnd,   timeZone: params.timezone },
        attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
        conferenceData: {
          createRequest: {
            requestId:             `gravhub-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create calendar event: ${err}`)
  }

  const data = await res.json()
  const meetLink = data.conferenceData?.entryPoints?.find(
    (e: { entryPointType: string; uri: string }) => e.entryPointType === 'video',
  )?.uri ?? null

  return { eventId: data.id, meetLink }
}

export async function listGoogleEvents(
  token: string,
  timeMin: string, // ISO date
  timeMax: string, // ISO date
): Promise<Array<{
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  attendees?: Array<{ email: string; displayName?: string }>
  hangoutLink?: string
  status: string
}>> {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const res = await fetch(
    `${GOOGLE_CALENDAR}/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Google Calendar list failed: ${res.status}`)
  const data = await res.json()
  return data.items ?? []
}

export async function updateGoogleEvent(
  eventId: string,
  data: { summary?: string; description?: string; start?: { dateTime: string; timeZone?: string }; end?: { dateTime: string; timeZone?: string } },
  token: string,
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR}/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) throw new Error(`Google Calendar update failed: ${res.status}`)
}

export async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  await fetch(`${GOOGLE_CALENDAR}/calendars/primary/events/${eventId}?sendUpdates=all`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

// ── Slot calculation ──────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period  = h < 12 ? 'AM' : 'PM'
  const hour    = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function isoToLocalTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
    timeZone: timezone,
  }).format(new Date(iso)).replace(/^24/, '00')
}

export function computeAvailableSlots(
  date:              string,
  settings:          CalendarSettings,
  googleBusySlots:   BusySlot[],
  existingBookings:  Pick<Booking, 'start_time' | 'end_time'>[],
): TimeSlot[] {
  // Check day of week (JS getDay: 0=Sun, 1=Mon … 6=Sat)
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay()
  if (!settings.available_days.includes(dayOfWeek)) return []

  // Don't return slots for dates in the past
  const today = new Date().toISOString().split('T')[0]
  if (date < today) return []

  const startMins  = timeToMinutes(settings.available_start)
  const endMins    = timeToMinutes(settings.available_end)
  const slotLen    = settings.duration
  const buffer     = settings.buffer
  const nowMins    = date === today
    ? new Date().getHours() * 60 + new Date().getMinutes() + 30 // 30-min lead time
    : 0

  // Convert Google busy slots to local time ranges
  const googleBusy = googleBusySlots.map(b => ({
    start: timeToMinutes(isoToLocalTime(b.start, settings.timezone)),
    end:   timeToMinutes(isoToLocalTime(b.end,   settings.timezone)),
  }))

  // Convert existing bookings to minute ranges (with buffer padding)
  const booked = existingBookings.map(b => ({
    start: timeToMinutes(b.start_time) - buffer,
    end:   timeToMinutes(b.end_time)   + buffer,
  }))

  const slots: TimeSlot[] = []

  for (let s = startMins; s + slotLen <= endMins; s += slotLen) {
    const slotStart = s
    const slotEnd   = s + slotLen

    // Skip past slots
    if (slotStart < nowMins) continue

    // Check Google busy
    const blockedByGoogle = googleBusy.some(
      b => slotStart < b.end && slotEnd > b.start,
    )
    if (blockedByGoogle) continue

    // Check existing bookings
    const blockedByBooking = booked.some(
      b => slotStart < b.end && slotEnd > b.start,
    )
    if (blockedByBooking) continue

    slots.push({
      start: minutesToTime(slotStart),
      end:   minutesToTime(slotEnd),
      label: formatLabel(minutesToTime(slotStart)),
    })
  }

  return slots
}
