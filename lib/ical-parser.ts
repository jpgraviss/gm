export interface ICalEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
  description: string
  location: string
}

export interface ICalCalendar {
  name: string
  events: ICalEvent[]
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

function parseICalDate(val: string): string {
  const clean = val.replace(/^.*:/, '')
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`
  }
  if (clean.length >= 15) {
    const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
    if (clean.endsWith('Z')) return iso + 'Z'
    return iso
  }
  return clean
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
      current.dtstart = parseICalDate(line)
    } else if (line.startsWith('DTEND')) {
      current.dtend = parseICalDate(line)
    } else if (line.startsWith('DESCRIPTION:') || line.startsWith('DESCRIPTION;')) {
      current.description = unescapeValue(getPropertyValue(line))
    } else if (line.startsWith('LOCATION:') || line.startsWith('LOCATION;')) {
      current.location = unescapeValue(getPropertyValue(line))
    }
  }

  return { name: calendarName, events }
}
