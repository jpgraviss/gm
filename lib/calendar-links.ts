import { compactWallClock, zonedWallTimeToUtc } from './timezone'

export interface CalendarLinkEvent {
  title: string
  startDateTime: string
  endDateTime: string
  timezone: string
  description: string
  location: string
}

// Outlook's deep link takes an absolute UTC instant (no separate timezone
// param), so startDateTime/endDateTime — wall-clock strings meaning "this
// time, in `timezone`" — must actually be converted to UTC here.
function toUTCCompact(dateStr: string, timezone: string): string {
  try {
    return zonedWallTimeToUtc(dateStr, timezone).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  } catch {
    return dateStr.replace(/[-:]/g, '').replace(/\.\d+/, '') + 'Z'
  }
}

// Google's link carries a separate `ctz` param declaring the timezone, so
// (like ICS's TZID) the digits themselves need no conversion — just
// reformatted, matching the wall-clock time the string already means.
function toCompact(dateStr: string): string {
  return compactWallClock(dateStr)
}

export function getGoogleCalendarLink(event: CalendarLinkEvent): string {
  const start = toCompact(event.startDateTime)
  const end = toCompact(event.endDateTime)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
    location: event.location,
    ctz: event.timezone,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function getOutlookCalendarLink(event: CalendarLinkEvent): string {
  const start = toUTCCompact(event.startDateTime, event.timezone)
  const end = toUTCCompact(event.endDateTime, event.timezone)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
    body: event.description,
    location: event.location,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`
}

export function getOutlook365CalendarLink(event: CalendarLinkEvent): string {
  const start = toUTCCompact(event.startDateTime, event.timezone)
  const end = toUTCCompact(event.endDateTime, event.timezone)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
    body: event.description,
    location: event.location,
  })
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params}`
}

export function getYahooCalendarLink(event: CalendarLinkEvent): string {
  // Yahoo's st param has no separate timezone declaration (no ctz-style
  // param like Google's link) — same requirement as Outlook, needs a real
  // UTC instant, not raw wall-clock digits.
  const start = toUTCCompact(event.startDateTime, event.timezone)
  // Both parsed the same (server-local) way — their difference is the
  // correct duration regardless of that basis being "wrong" in isolation.
  const d1 = new Date(event.startDateTime)
  const d2 = new Date(event.endDateTime)
  const durationMs = d2.getTime() - d1.getTime()
  const hours = String(Math.floor(durationMs / 3600000)).padStart(2, '0')
  const minutes = String(Math.floor((durationMs % 3600000) / 60000)).padStart(2, '0')
  const params = new URLSearchParams({
    v: '60',
    title: event.title,
    st: start,
    dur: `${hours}${minutes}`,
    desc: event.description,
    in_loc: event.location,
  })
  return `https://calendar.yahoo.com/?${params}`
}

export function getICSDownloadUrl(bookingId: string): string {
  return `/api/calendar/bookings/${bookingId}/ics`
}
