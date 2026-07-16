import { compactWallClock } from './timezone'

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
  // startDateTime/endDateTime are wall-clock strings meaning "this time, in
  // event.timezone" — DTSTART;TZID=<tz> wants exactly those digits, not a
  // UTC conversion, so no timezone math happens here at all (the TZID
  // parameter is what tells the calendar app which zone the digits mean).
  const dtstart = compactWallClock(event.startDateTime)
  const dtend = compactWallClock(event.endDateTime)

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
