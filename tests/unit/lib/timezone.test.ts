import { describe, it, expect } from 'vitest'
import { zonedWallTimeToUtc, dateAndTimeInZone, compactWallClock } from '@/lib/timezone'

describe('zonedWallTimeToUtc', () => {
  it('converts a summer (CDT, UTC-5) wall-clock time to the correct UTC instant', () => {
    const utc = zonedWallTimeToUtc('2026-07-14T14:00', 'America/Chicago')
    expect(utc.toISOString()).toBe('2026-07-14T19:00:00.000Z')
  })

  it('converts a winter (CST, UTC-6) wall-clock time to the correct UTC instant', () => {
    const utc = zonedWallTimeToUtc('2026-01-14T14:00', 'America/Chicago')
    expect(utc.toISOString()).toBe('2026-01-14T20:00:00.000Z')
  })

  it('is a no-op offset for UTC itself', () => {
    const utc = zonedWallTimeToUtc('2026-07-14T14:00', 'UTC')
    expect(utc.toISOString()).toBe('2026-07-14T14:00:00.000Z')
  })

  it('handles a positive-offset zone (JST, UTC+9)', () => {
    const utc = zonedWallTimeToUtc('2026-07-14T09:00', 'Asia/Tokyo')
    expect(utc.toISOString()).toBe('2026-07-14T00:00:00.000Z')
  })

  it('accepts a seconds-included wall-clock string', () => {
    const utc = zonedWallTimeToUtc('2026-07-14T14:00:30', 'America/Chicago')
    expect(utc.toISOString()).toBe('2026-07-14T19:00:30.000Z')
  })
})

describe('dateAndTimeInZone', () => {
  it('reads a UTC instant back as the correct Chicago wall-clock time', () => {
    const { date, time } = dateAndTimeInZone(new Date('2026-07-14T19:00:00.000Z'), 'America/Chicago')
    expect(date).toBe('2026-07-14')
    expect(time).toBe('14:00')
  })

  it('rolls the calendar date back across a UTC midnight boundary for a western zone', () => {
    // 2026-07-15 01:00 UTC is still 2026-07-14 20:00 in Chicago (CDT, UTC-5)
    const { date, time } = dateAndTimeInZone(new Date('2026-07-15T01:00:00.000Z'), 'America/Chicago')
    expect(date).toBe('2026-07-14')
    expect(time).toBe('20:00')
  })

  it('round-trips with zonedWallTimeToUtc', () => {
    const utc = zonedWallTimeToUtc('2026-03-01T09:30', 'America/New_York')
    const { date, time } = dateAndTimeInZone(utc, 'America/New_York')
    expect(date).toBe('2026-03-01')
    expect(time).toBe('09:30')
  })
})

describe('compactWallClock', () => {
  it('formats a wall-clock string into ICS/Google-link compact form without any zone conversion', () => {
    expect(compactWallClock('2026-07-14T14:00')).toBe('20260714T140000')
    expect(compactWallClock('2026-07-14T14:00:30')).toBe('20260714T140030')
  })

  it('falls back gracefully on an unparseable string', () => {
    expect(compactWallClock('not-a-date')).toBe('notadate')
  })
})
