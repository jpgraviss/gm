import { zonedWallTimeToUtc } from '@/lib/timezone'

export interface ICalEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
  // IANA zone the corresponding *start/end wall-clock string should be
  // interpreted in, from a `TZID=` param on the source DTSTART/DTEND line.
  // 'UTC' when the value carried a trailing Z. Undefined for a "floating"
  // value with neither (AUDIT #620 — this used to be silently discarded).
  dtstartTzid?: string
  dtendTzid?: string
  description: string
  location: string
}

export interface ICalCalendar {
  name: string
  events: ICalEvent[]
}

/**
 * Resolves an ICS wall-clock value + its (possibly absent) TZID into the
 * real UTC instant it represents. A `tzid` of `'UTC'` (a Z-suffixed value)
 * or a real IANA zone is converted properly; a floating value (no TZID)
 * falls back to the pre-#620 behavior of treating it as server-local, since
 * a floating time has no well-defined meaning to convert from.
 */
export function icalDateToUtc(value: string, tzid: string | undefined): Date {
  if (!value) return new Date(NaN)
  if (tzid === 'UTC') return new Date(value)
  if (tzid) {
    try {
      return zonedWallTimeToUtc(value.replace(/Z$/, ''), tzid)
    } catch {
      return new Date(value)
    }
  }
  return new Date(value)
}

function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, '')
}

function unescapeValue(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseICalDate(val: string): { value: string; tzid?: string } {
  const clean = val.replace(/^.*:/, '')
  // e.g. "DTSTART;TZID=America/Chicago:20260315T140000" — the TZID param
  // sits before the ':' that separates params from the value.
  const tzidMatch = val.slice(0, val.indexOf(':')).match(/TZID=([^;:]+)/)
  const tzid = tzidMatch?.[1]

  if (clean.length === 8) {
    return { value: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`, tzid }
  }
  if (clean.length >= 15) {
    const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
    if (clean.endsWith('Z')) return { value: iso + 'Z', tzid: 'UTC' }
    return { value: iso, tzid }
  }
  return { value: clean, tzid }
}

function getPropertyValue(line: string): string {
  const idx = line.indexOf(':')
  if (idx === -1) return line
  return line.slice(idx + 1)
}

export function parseICS(raw: string): ICalCalendar {
  const lines = unfold(raw).split(/\r?\n/)
  let calendarName = 'Imported Calendar'
  const events: ICalEvent[] = []
  let current: Partial<ICalEvent> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) {
        events.push({
          uid: current.uid || `ics-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          summary: current.summary || 'Untitled Event',
          dtstart: current.dtstart || '',
          dtend: current.dtend || current.dtstart || '',
          dtstartTzid: current.dtstartTzid,
          dtendTzid: current.dtendTzid ?? current.dtstartTzid,
          description: current.description || '',
          location: current.location || '',
        })
      }
      current = null
      continue
    }

    if (!current && line.startsWith('X-WR-CALNAME:')) {
      calendarName = getPropertyValue(line)
      continue
    }

    if (!current) continue

    if (line.startsWith('UID:') || line.startsWith('UID;')) {
      current.uid = unescapeValue(getPropertyValue(line))
    } else if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
      current.summary = unescapeValue(getPropertyValue(line))
    } else if (line.startsWith('DTSTART')) {
      const { value, tzid } = parseICalDate(line)
      current.dtstart = value
      current.dtstartTzid = tzid
    } else if (line.startsWith('DTEND')) {
      const { value, tzid } = parseICalDate(line)
      current.dtend = value
      current.dtendTzid = tzid
    } else if (line.startsWith('DESCRIPTION:') || line.startsWith('DESCRIPTION;')) {
      current.description = unescapeValue(getPropertyValue(line))
    } else if (line.startsWith('LOCATION:') || line.startsWith('LOCATION;')) {
      current.location = unescapeValue(getPropertyValue(line))
    }
  }

  return { name: calendarName, events }
}
