// Booking wall-clock strings ("YYYY-MM-DDTHH:MM[:SS]") mean "this clock
// time in the booking's configured IANA timezone" — never UTC and never
// the server's local time. `new Date(dateStr)` (no offset suffix) is
// parsed per the JS spec as the *environment's* local time, which on
// Vercel is always UTC — silently wrong for any non-UTC configured
// timezone. These helpers do the conversion correctly, DST included, using
// only Intl (no added dependency).

/**
 * Converts a wall-clock string meaning "this time, in `timeZone`" into the
 * real UTC instant it represents.
 */
export function zonedWallTimeToUtc(dateStr: string, timeZone: string): Date {
  const withSeconds = /T\d{2}:\d{2}$/.test(dateStr) ? `${dateStr}:00` : dateStr
  const naiveUtc = new Date(`${withSeconds}Z`)
  if (isNaN(naiveUtc.getTime())) {
    throw new Error(`Invalid date string: ${dateStr}`)
  }

  // Two-pass offset resolution: a single pass can be off by the DST delta
  // right around a transition; re-resolving the offset against the first
  // estimate converges for every real-world case.
  const offset1 = timeZoneOffsetMs(naiveUtc, timeZone)
  const estimate = new Date(naiveUtc.getTime() - offset1)
  const offset2 = timeZoneOffsetMs(estimate, timeZone)
  return new Date(naiveUtc.getTime() - offset2)
}

/** Milliseconds to add to a UTC instant to get its wall-clock reading in `timeZone` (negative west of UTC). */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const map = zonedParts(date, timeZone)
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  )
  return asUtc - date.getTime()
}

function zonedParts(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  if (map.hour === '24') map.hour = '00' // some ICU builds report midnight as hour 24
  return map
}

/** The calendar date ("YYYY-MM-DD") and wall-clock time ("HH:MM") a UTC instant reads as in `timeZone`. */
export function dateAndTimeInZone(date: Date, timeZone: string): { date: string; time: string } {
  const p = zonedParts(date, timeZone)
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  }
}

/** The current calendar date and minutes-since-midnight, as read in `timeZone`. */
export function nowInZone(timeZone: string): { date: string; minutes: number } {
  const { date, time } = dateAndTimeInZone(new Date(), timeZone)
  const [h, m] = time.split(':').map(Number)
  return { date, minutes: h * 60 + m }
}

/** Wall-clock digits only, formatted as ICS/Google-link compact form ("YYYYMMDDTHHMMSS") — no timezone math, since the caller declares the zone separately (TZID, ctz). */
export function compactWallClock(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return dateStr.replace(/[-:]/g, '').slice(0, 15)
  const [, yr, mo, day, hr, min, sec = '00'] = match
  return `${yr}${mo}${day}T${hr}${min}${sec}`
}
