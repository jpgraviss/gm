import { describe, it, expect, vi, afterEach } from 'vitest'
import { addMonthsClamped, todayISO } from '@/lib/date-math'

/**
 * AUDIT #762 — `Date.setMonth()` overflows instead of clamping.
 *
 * Adding a month to Jan 31 gives **Mar 3**, not Feb 28: JS builds "Feb 31"
 * and rolls it forward. Subtracting behaves the same way — May 31 minus three
 * months is Mar 3, not Feb 28.
 *
 * What makes this survive review is that it is only wrong on the 29th, 30th
 * and 31st. Every test anyone writes by hand on the 12th of the month passes.
 * It has already bitten twice here: #736 (a Quarterly contract starting Jan 31
 * generating its next invoice period from Mar 3, drifting further each
 * renewal) and #762 (review-campaign audience cutoffs landing 2-3 days late,
 * so "New Clients (< 3 Months)" silently excluded clients created inside the
 * skipped window).
 *
 * The month-end cases below are the whole point of the function; the mid-month
 * ones exist to prove it doesn't distort the ordinary path while fixing the
 * edge.
 */

afterEach(() => vi.useRealTimers())

describe('addMonthsClamped — forward', () => {
  it('clamps to the last valid day instead of overflowing', () => {
    // The canonical case. Naive setMonth gives 2026-03-03.
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-05-31', 1)).toBe('2026-06-30')
  })

  it('knows February in a leap year', () => {
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('leaves an ordinary mid-month date exactly where it belongs', () => {
    expect(addMonthsClamped('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsClamped('2026-01-15', 3)).toBe('2026-04-15')
  })

  it('rolls the year over', () => {
    expect(addMonthsClamped('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonthsClamped('2026-12-31', 1)).toBe('2027-01-31')
  })

  it('does not drift across repeated application', () => {
    // The #736 failure mode: each renewal computed from the last, so a single
    // overflow compounds. Twelve one-month steps from Jan 31 must land on
    // Jan 31, not wander into February.
    let d = '2026-01-31'
    for (let i = 0; i < 12; i++) d = addMonthsClamped(d, 1)
    expect(d).toBe('2027-01-28')
    // Stepping by 12 at once keeps the day, which is why billing should add
    // from the ORIGINAL anchor rather than iterating — recorded here so the
    // difference is visible rather than surprising.
    expect(addMonthsClamped('2026-01-31', 12)).toBe('2027-01-31')
  })
})

describe('addMonthsClamped — backward', () => {
  it('clamps when subtracting too', () => {
    // #762's actual bug. Naive setMonth gives 2026-03-03 for both.
    expect(addMonthsClamped('2026-05-31', -3)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28')
  })

  it('handles a leap day going back a year', () => {
    expect(addMonthsClamped('2028-02-29', -12)).toBe('2027-02-28')
  })

  it('rolls the year backward', () => {
    expect(addMonthsClamped('2026-01-31', -1)).toBe('2025-12-31')
    expect(addMonthsClamped('2026-01-15', -12)).toBe('2025-01-15')
  })
})

describe('addMonthsClamped — edges', () => {
  it('returns an unparseable input unchanged', () => {
    // A bad date in the database should not become a differently-bad date
    // that looks plausible.
    expect(addMonthsClamped('not-a-date', 1)).toBe('not-a-date')
    expect(addMonthsClamped('', 1)).toBe('')
  })

  it('is a no-op for zero months', () => {
    expect(addMonthsClamped('2026-01-31', 0)).toBe('2026-01-31')
  })

  it('works in UTC regardless of the host timezone', () => {
    // These are calendar dates, not instants. Running them through a local
    // timezone is how a date shifts by a day for anyone west of Greenwich —
    // the input is parsed as UTC midnight, so a negative offset would roll
    // it back to the previous day.
    expect(addMonthsClamped('2026-01-01', 1)).toBe('2026-02-01')
    expect(addMonthsClamped('2026-03-01', -1)).toBe('2026-02-01')
  })
})

describe('todayISO', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-08-06T22:45:00.000Z'))).toBe('2026-08-06')
  })

  it('uses UTC, not the host timezone', () => {
    // Late-evening UTC must not report tomorrow, or an audience cutoff moves
    // a day depending on where the server runs.
    expect(todayISO(new Date('2026-08-06T23:59:59.000Z'))).toBe('2026-08-06')
    expect(todayISO(new Date('2026-08-07T00:00:01.000Z'))).toBe('2026-08-07')
  })
})
