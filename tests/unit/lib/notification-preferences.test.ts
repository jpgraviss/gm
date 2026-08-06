import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isPushAllowedForEvent,
  isWithinQuietHours,
  ACTIVITY_NOTIF_DEFAULTS,
  QUIET_HOURS_DEFAULTS,
  EVENT_TO_ACTIVITY_LABEL,
  type NotificationPreferences,
  type QuietHours,
} from '@/lib/notification-preferences'

/**
 * AUDIT #532 backfill — the push-notification gate had zero tests.
 *
 * `shouldSendPushForEvent()` is the last thing every real push send in this
 * app passes through (three call sites in `lib/automations-engine.ts`, one in
 * `lib/ticket-routing.ts`). It decides, per event, whether a notification
 * reaches a human. Both ways of getting it wrong are silent: too strict and
 * nobody is ever told a contract was signed, too loose and Quiet Hours does
 * nothing and staff get woken at 3am. Neither shows up as an error anywhere.
 *
 * It was built by #406 to make Settings > Notifications stop being
 * write-only, and #406's own note is that the shape here mirrors
 * `app/settings/page.tsx`'s local defaults and is "kept in sync by hand" —
 * hand-synced constants are exactly the thing worth pinning down in a test.
 *
 * The overnight window is the part most likely to break under edit:
 * 22:00–08:00 wraps midnight, so the naive `start <= now < end` comparison
 * that reads correctly for 09:00–17:00 silently inverts it.
 */

function prefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    activity: ACTIVITY_NOTIF_DEFAULTS,
    quiet_hours: QUIET_HOURS_DEFAULTS,
    ...overrides,
  }
}

/** A UTC instant whose America/Chicago wall clock is `hh:mm`. Chicago is UTC-5 in July (CDT). */
function chicago(hh: number, mm = 0): Date {
  return new Date(Date.UTC(2026, 6, 15, hh + 5, mm))
}

describe('isPushAllowedForEvent', () => {
  it('sends for an event with no matching Settings row', () => {
    // No user-facing toggle exists for it, so there is nothing to honor —
    // gating it would silently drop notifications the user never opted out of.
    expect(isPushAllowedForEvent(prefs(), 'some_event_with_no_ui')).toBe(true)
    expect(isPushAllowedForEvent(prefs(), undefined)).toBe(true)
  })

  it('suppresses when the matrix row is disabled', () => {
    const label = EVENT_TO_ACTIVITY_LABEL.contract_executed
    expect(isPushAllowedForEvent(prefs({
      activity: [{ label, enabled: false, channel: 'push' }],
    }), 'contract_executed')).toBe(false)
  })

  it('only treats push-bearing channels as push', () => {
    const label = EVENT_TO_ACTIVITY_LABEL.contract_executed
    const withChannel = (channel: NotificationPreferences['activity'][number]['channel']) =>
      isPushAllowedForEvent(prefs({ activity: [{ label, enabled: true, channel }] }), 'contract_executed')

    expect(withChannel('push')).toBe(true)
    expect(withChannel('push+email')).toBe(true)
    // These mean "notify me, but not by push". Treating them as push is the
    // failure that makes the channel dropdown decorative.
    expect(withChannel('in-app')).toBe(false)
    expect(withChannel('email+in-app')).toBe(false)
    expect(withChannel('muted')).toBe(false)
  })

  it('sends when the row is missing from a saved-but-partial matrix', () => {
    // A preferences blob written by an older build won't have every row.
    // Defaulting those to "suppress" would silently disable notifications
    // on upgrade.
    expect(isPushAllowedForEvent(prefs({ activity: [] }), 'contract_executed')).toBe(true)
  })

  it('maps every event key to a label that actually exists in the defaults', () => {
    // The hand-sync #406 warns about: if a Settings label is reworded and
    // EVENT_TO_ACTIVITY_LABEL isn't, `.find()` returns undefined and the
    // gate quietly falls through to "always send" — the feature stops
    // working with no error anywhere.
    const labels = new Set(ACTIVITY_NOTIF_DEFAULTS.map(a => a.label))
    const orphaned = Object.entries(EVENT_TO_ACTIVITY_LABEL)
      .filter(([, label]) => !labels.has(label))
      .map(([event, label]) => `${event} -> "${label}"`)
    expect(orphaned).toEqual([])
  })

  it('stays in sync with the labels Settings actually renders', () => {
    // #406's own note: `app/settings/page.tsx` is a 'use client' page that
    // can't be imported here, so it keeps its own copy of the same list and
    // the two are "kept in sync by hand". The join between them is the label
    // STRING, so rewording one row in Settings — a change that looks purely
    // cosmetic — makes `.find()` miss, and `isPushAllowedForEvent` falls
    // through to "always send". The feature stops working with nothing
    // logged and nothing thrown. Reading the file is the only way to check a
    // constant that lives inside a client page.
    const page = readFileSync(resolve(__dirname, '../../../app/settings/page.tsx'), 'utf-8')
    const start = page.indexOf('const ACTIVITY_NOTIF_DEFAULTS')
    expect(start).toBeGreaterThan(-1) // the constant was renamed or moved
    const block = page.slice(start, page.indexOf('\n]', start))
    const pageLabels = [...block.matchAll(/label:\s*'([^']+)'/g)].map(m => m[1])

    expect(pageLabels.length).toBeGreaterThan(0)
    expect(pageLabels).toEqual(ACTIVITY_NOTIF_DEFAULTS.map(a => a.label))
  })
})

describe('isWithinQuietHours', () => {
  const overnight: QuietHours = { enabled: true, start: '22:00', end: '08:00' }
  const daytime: QuietHours = { enabled: true, start: '09:00', end: '17:00' }

  it('is never active while disabled', () => {
    expect(isWithinQuietHours({ ...overnight, enabled: false }, 'America/Chicago', chicago(23))).toBe(false)
  })

  it('covers both sides of midnight for an overnight window', () => {
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(23))).toBe(true)  // before midnight
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(3))).toBe(true)   // after midnight
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(12))).toBe(false) // midday
  })

  it('treats start as inclusive and end as exclusive', () => {
    // Without this, 22:00 either double-counts or leaves a one-minute hole.
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(22, 0))).toBe(true)
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(21, 59))).toBe(false)
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(7, 59))).toBe(true)
    expect(isWithinQuietHours(overnight, 'America/Chicago', chicago(8, 0))).toBe(false)
  })

  it('handles a same-day window without wrapping', () => {
    expect(isWithinQuietHours(daytime, 'America/Chicago', chicago(12))).toBe(true)
    expect(isWithinQuietHours(daytime, 'America/Chicago', chicago(8))).toBe(false)
    expect(isWithinQuietHours(daytime, 'America/Chicago', chicago(18))).toBe(false)
  })

  it('reads the clock in the configured zone, not the server zone', () => {
    // The whole reason a timezone is threaded through. 03:00 Chicago is
    // 09:00 in London — quiet for one office, working hours for the other.
    const at3amChicago = chicago(3)
    expect(isWithinQuietHours(overnight, 'America/Chicago', at3amChicago)).toBe(true)
    expect(isWithinQuietHours(overnight, 'Europe/London', at3amChicago)).toBe(false)
  })

  it('falls back to the default zone rather than throwing on a bad one', () => {
    // Settings > Company's timezone is a free-text field whose own default
    // UI value ('America/New_York (ET)') is not a valid IANA identifier and
    // throws inside Intl. Crashing here would take down the send path.
    expect(() => isWithinQuietHours(overnight, 'America/New_York (ET)', chicago(23))).not.toThrow()
    expect(isWithinQuietHours(overnight, 'America/New_York (ET)', chicago(23))).toBe(true)
    expect(isWithinQuietHours(overnight, undefined, chicago(23))).toBe(true)
  })

  it('never treats a zero-length window as all day', () => {
    // A misconfiguration, not a request for 24h silence. Reading it as
    // all-day would mute every notification with no visible cause.
    expect(isWithinQuietHours({ enabled: true, start: '22:00', end: '22:00' }, 'America/Chicago', chicago(22))).toBe(false)
    expect(isWithinQuietHours({ enabled: true, start: '22:00', end: '22:00' }, 'America/Chicago', chicago(3))).toBe(false)
  })

  it('does not suppress on unparseable times', () => {
    // Fail open: a corrupt setting should not silently mute the app.
    expect(isWithinQuietHours({ enabled: true, start: 'nonsense', end: '08:00' }, 'America/Chicago', chicago(23))).toBe(false)
  })
})

describe('shouldSendPushForEvent', () => {
  // Exercised through the module boundary so the composition is covered, not
  // just the two halves — a gate that checks the matrix but forgets Quiet
  // Hours passes every test above.
  const settings = { company: { timezone: 'America/Chicago' } }

  function loadWith(storedPrefs: unknown) {
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({
      createServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { notification_preferences: storedPrefs } }) }),
          }),
        }),
      }),
    }))
    vi.doMock('@/lib/settings', () => ({ getSettings: async () => settings }))
    return import('@/lib/notification-preferences')
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  it('sends when the matrix allows it and it is outside quiet hours', async () => {
    vi.setSystemTime(chicago(12))
    const mod = await loadWith({
      activity: [{ label: EVENT_TO_ACTIVITY_LABEL.contract_executed, enabled: true, channel: 'push' }],
      quiet_hours: { enabled: true, start: '22:00', end: '08:00' },
    })
    expect(await mod.shouldSendPushForEvent('contract_executed')).toBe(true)
    vi.useRealTimers()
  })

  it('suppresses inside quiet hours even when the matrix allows it', async () => {
    vi.setSystemTime(chicago(23))
    const mod = await loadWith({
      activity: [{ label: EVENT_TO_ACTIVITY_LABEL.contract_executed, enabled: true, channel: 'push' }],
      quiet_hours: { enabled: true, start: '22:00', end: '08:00' },
    })
    expect(await mod.shouldSendPushForEvent('contract_executed')).toBe(false)
    vi.useRealTimers()
  })

  it('suppresses on channel even outside quiet hours', async () => {
    vi.setSystemTime(chicago(12))
    const mod = await loadWith({
      activity: [{ label: EVENT_TO_ACTIVITY_LABEL.contract_executed, enabled: true, channel: 'in-app' }],
      quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
    })
    expect(await mod.shouldSendPushForEvent('contract_executed')).toBe(false)
    vi.useRealTimers()
  })
})
