export interface ICSEventInput {
  title: string
  startDateTime: string
  endDateTime: string
  timezone: string
  description: string
  location: string
  organizerName: string
  organizerEmail: string
  attendeeEmail: string
  uid?: string
}

function formatICSDate(dateStr: string, timezone: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    const clean = dateStr.replace(/[-:]/g, '').replace('T', 'T')
    return clean.length >= 15 ? clean.slice(0, 15) : clean
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
  if (!match) {
    return dateStr.replace(/[-:]/g, '').slice(0, 15)
  }
  const [, mo, day, yr, hr, min, sec] = match
  return `${yr}${mo}${day}T${hr}${min}${sec}`
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  const result: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    result.push(remaining.slice(0, 75))
    remaining = ' ' + remaining.slice(75)
  }
  result.push(remaining)
  return result.join('\r\n')
}

export function generateICS(event: ICSEventInput): string {
  const uid = event.uid ?? `${crypto.randomUUID()}@gravhub`
  const now = new Date()
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dtstart = formatICSDate(event.startDateTime, event.timezone)
  const dtend = formatICSDate(event.endDateTime, event.timezone)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GravHub//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${event.timezone}:${dtstart}`,
    `DTEND;TZID=${event.timezone}:${dtend}`,
    foldLine(`SUMMARY:${escapeICSText(event.title)}`),
    foldLine(`DESCRIPTION:${escapeICSText(event.description)}`),
    foldLine(`LOCATION:${escapeICSText(event.location)}`),
    foldLine(`ORGANIZER;CN=${escapeICSText(event.organizerName)}:mailto:${event.organizerEmail}`),
    foldLine(`ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeICSText(event.attendeeEmail)}:mailto:${event.attendeeEmail}`),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    `BEGIN:VALARM`,
    `TRIGGER:-PT15M`,
    `ACTION:DISPLAY`,
    `DESCRIPTION:Reminder`,
    `END:VALARM`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n') + '\r\n'
}
