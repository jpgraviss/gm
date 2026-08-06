/**
 * Calendar arithmetic that doesn't silently skip a month (AUDIT #762).
 *
 * `Date.setMonth()` overflows rather than clamping. Adding a month to Jan 31
 * gives Mar 3, not Feb 28 — because JS builds "Feb 31" and then rolls it
 * forward. Subtracting works the same way: May 31 minus three months is Mar 3,
 * not Feb 28.
 *
 * The result is a date that is silently 2–3 days off, and only on the 29th,
 * 30th and 31st — so it survives casual testing and misbehaves for a few days
 * every month. It has already bitten twice here:
 *
 *   - #736, billing: a Quarterly contract starting Jan 31 generated its next
 *     invoice period from Mar 3, drifting further every renewal.
 *   - #762, review campaigns: "New Clients (< 3 Months)" computed its cutoff
 *     with raw `setMonth`, so on the 31st it excluded clients created in the
 *     three days it skipped over — from a campaign they qualified for.
 *
 * This lives in its own module rather than in `lib/recurring-billing.ts`,
 * where it was written, because the second consumer is a marketing audience
 * filter and importing a billing module for calendar maths is the wrong
 * shape.
 */

/**
 * Adds (or, with a negative `months`, subtracts) calendar months, clamping to
 * the last valid day of the target month instead of overflowing into the next.
 *
 * Takes and returns a `YYYY-MM-DD` string. Operates entirely in UTC: these
 * values are calendar dates, not instants, and running them through a local
 * timezone is how a date shifts by a day for anyone west of Greenwich.
 *
 * An unparseable input is returned unchanged — a bad date in the database
 * should not become a differently-bad date.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  const day = d.getUTCDate()
  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0)).getUTCDate()
  const result = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
    Math.min(day, lastDayOfTarget),
  ))
  return result.toISOString().split('T')[0]
}

/** Today as `YYYY-MM-DD` in UTC — the format every date column here uses. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().split('T')[0]
}
