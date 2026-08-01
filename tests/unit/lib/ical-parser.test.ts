import { describe, it, expect } from 'vitest'
import { parseICS, icalDateToUtc } from '@/lib/ical-parser'

// AUDIT #620 — DTSTART/DTEND TZID params were discarded on parse, so a
// non-UTC event's wall-clock value got interpreted as server-local (UTC on
// Vercel) instead of its real source timezone, silently corrupting
// downstream booking-availability comparisons.

describe('parseICS TZID handling (#620)', () => {
  it('captures the TZID param off a DTSTART/DTEND line', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:evt-1',
      'SUMMARY:Team sync',
      'DTSTART;TZID=America/Chicago:20260315T140000',
      'DTEND;TZID=America/Chicago:20260315T150000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const cal = parseICS(ics)
    expect(cal.events).toHaveLength(1)
    expect(cal.events[0].dtstart).toBe('2026-03-15T14:00:00')
    expect(cal.events[0].dtstartTzid).toBe('America/Chicago')
    expect(cal.events[0].dtendTzid).toBe('America/Chicago')
  })

  it('marks a Z-suffixed value as UTC', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:evt-2',
      'DTSTART:20260315T140000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const cal = parseICS(ics)
    expect(cal.events[0].dtstartTzid).toBe('UTC')
  })

  it('leaves tzid undefined for a floating value', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:evt-3',
      'DTSTART:20260315T140000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const cal = parseICS(ics)
    expect(cal.events[0].dtstartTzid).toBeUndefined()
  })
})

describe('icalDateToUtc (#620)', () => {
  it('converts a TZID wall-clock value to the correct UTC instant', () => {
    // 2pm America/Chicago in March 2026 is CDT (UTC-5) -> 19:00 UTC
    const utc = icalDateToUtc('2026-03-15T14:00:00', 'America/Chicago')
    expect(utc.toISOString()).toBe('2026-03-15T19:00:00.000Z')
  })

  it('parses a UTC value directly', () => {
    const utc = icalDateToUtc('2026-03-15T14:00:00Z', 'UTC')
    expect(utc.toISOString()).toBe('2026-03-15T14:00:00.000Z')
  })

  it('falls back to native Date parsing for a floating value', () => {
    const utc = icalDateToUtc('2026-03-15T14:00:00', undefined)
    expect(utc.getUTCFullYear()).toBe(2026)
  })
})
