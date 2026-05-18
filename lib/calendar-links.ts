export interface CalendarLinkEvent {
  title: string
  startDateTime: string
  endDateTime: string
  timezone: string
  description: string
  location: string
}

function toUTCCompact(dateStr: string, timezone: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    return dateStr.replace(/[-:]/g, '').replace(/\.\d+/, '') + 'Z'
  }
  const utc = new Date(
    d.toLocaleString('en-US', { timeZone: timezone }),
  )
  const offset = utc.getTime() - d.getTime()
  const adjusted = new Date(d.getTime() - offset)
  return adjusted.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
}

function toCompact(dateStr: string, timezone: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    return dateStr.replace(/[-:]/g, '').slice(0, 15)
  }
  const formatted = d.toLocaleString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const match = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return dateStr.replace(/[-:]/g, '').slice(0, 15)
  const [, mo, day, yr, hr, min, sec] = match
  return `${yr}${mo}${day}T${hr}${min}${sec}`
}

export function getGoogleCalendarLink(event: CalendarLinkEvent): string {
  const start = toCompact(event.startDateTime, event.timezone)
  const end = toCompact(event.endDateTime, event.timezone)
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
  const start = toCompact(event.startDateTime, event.timezone)
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
