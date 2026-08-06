import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  REAUTH_WINDOW_DAYS, isWithinReauthWindow, reauthDueDate, daysUntilReauth,
} from '@/lib/oauth-expiry'

/**
 * AUDIT #752 — the 180-day OAuth re-consent window.
 *
 * `isWithinReauthWindow()` was already enforced by `lib/google-marketing.ts`
 * and `lib/meta-ads.ts`, but had no tests. `reauthDueDate()` and
 * `daysUntilReauth()` had neither tests nor callers — they exist to warn
 * someone *before* a connection dies, and nothing used them, so the Settings
 * page only ever showed "Re-authorization required" after sync had already
 * stopped. Wiring the warning up makes their exact boundaries matter.
 *
 * The behaviour that carries risk is the fail-OPEN on a missing
 * `connected_at`: legacy rows predate the column, and treating them as
 * expired would disconnect every one of them at once. Three of the cases
 * below pin that down.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** An ISO timestamp exactly `days` in the past. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

afterEach(() => vi.useRealTimers())

describe('isWithinReauthWindow', () => {
  it('accepts a fresh connection and rejects an old one', () => {
    expect(isWithinReauthWindow(daysAgo(1))).toBe(true)
    expect(isWithinReauthWindow(daysAgo(REAUTH_WINDOW_DAYS + 1))).toBe(false)
  })

  it('treats a missing connected_at as valid', () => {
    // Fails OPEN on purpose. Google Drive and Calendar rows never stored
    // this column; reading absence as "expired" would cut off every legacy
    // connection the moment this shipped.
    expect(isWithinReauthWindow(null)).toBe(true)
    expect(isWithinReauthWindow(undefined)).toBe(true)
  })

  it('treats an unparseable connected_at as valid rather than expired', () => {
    // Same reasoning: a corrupt value should not silently disconnect a
    // working integration.
    expect(isWithinReauthWindow('not-a-date')).toBe(true)
  })

  it('accepts a Date as well as a string', () => {
    expect(isWithinReauthWindow(new Date(Date.now() - DAY_MS))).toBe(true)
  })
})

describe('daysUntilReauth', () => {
  it('counts down toward the window', () => {
    expect(daysUntilReauth(daysAgo(REAUTH_WINDOW_DAYS - 10))).toBe(10)
    expect(daysUntilReauth(daysAgo(0))).toBe(REAUTH_WINDOW_DAYS)
  })

  it('goes negative once overdue', () => {
    // The Settings warning keys on `> 0`, so an overdue connection must not
    // read as "due in N days" — that would replace the real "expired"
    // banner with a reassuring one.
    expect(daysUntilReauth(daysAgo(REAUTH_WINDOW_DAYS + 5))).toBeLessThan(0)
  })

  it('returns Infinity when there is no connected_at', () => {
    // Consistent with isWithinReauthWindow's fail-open, and the reason the
    // Settings page filters on Number.isFinite: a legacy row must not
    // produce a warning at all.
    expect(daysUntilReauth(null)).toBe(Infinity)
    expect(daysUntilReauth('not-a-date')).toBe(Infinity)
  })
})

describe('reauthDueDate', () => {
  it('is exactly the window past the connection date', () => {
    const connectedAt = new Date('2026-01-01T00:00:00.000Z')
    const due = reauthDueDate(connectedAt)
    expect(due?.getTime()).toBe(connectedAt.getTime() + REAUTH_WINDOW_DAYS * DAY_MS)
  })

  it('is null without a connection date', () => {
    expect(reauthDueDate(null)).toBeNull()
    expect(reauthDueDate('not-a-date')).toBeNull()
  })

  it('agrees with isWithinReauthWindow at the boundary', () => {
    // The two are used by different call sites — the gate by the token
    // refresh path, the countdown by the UI. If they ever disagreed about
    // where the line is, the banner would contradict the behaviour.
    vi.useFakeTimers()
    const connectedAt = new Date('2026-01-01T00:00:00.000Z')
    const due = reauthDueDate(connectedAt)!

    vi.setSystemTime(new Date(due.getTime() - 1000))
    expect(isWithinReauthWindow(connectedAt)).toBe(true)
    expect(daysUntilReauth(connectedAt)).toBeGreaterThan(0)

    vi.setSystemTime(new Date(due.getTime() + 1000))
    expect(isWithinReauthWindow(connectedAt)).toBe(false)
    expect(daysUntilReauth(connectedAt)).toBeLessThanOrEqual(0)
  })
})
