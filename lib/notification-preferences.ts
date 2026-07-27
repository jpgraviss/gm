// AUDIT.md #406 — Settings > Notifications (Activity Notifications matrix +
// Quiet Hours) saved to `app_settings.notification_preferences` but nothing
// server-side ever read it back, so every toggle/channel/quiet-hours choice
// was write-only. This module is the read side: it's what
// lib/automations-engine.ts (the only real push-notification sender in the
// app — see AUDIT.md #406) consults before calling sendPushNotification().
//
// The shape here (ActivityNotificationPref, QuietHours, defaults) mirrors
// app/settings/page.tsx's local ACTIVITY_NOTIF_DEFAULTS/QUIET_HOURS_DEFAULTS/
// ChannelPref exactly — that page can't be imported here (it's a 'use client'
// page component, not a shared module), so the two are kept in sync by hand,
// same as automations-engine.ts's own TRIGGER_MAP already has to be kept in
// sync with app/automation/builder/page.tsx's trigger labels.
import { createServiceClient } from '@/lib/supabase'
import { getSettings } from '@/lib/settings'
import { dateAndTimeInZone } from '@/lib/timezone'

export type NotificationChannel = 'in-app' | 'email+in-app' | 'push' | 'push+email' | 'muted'

export interface ActivityNotificationPref {
  label: string
  enabled: boolean
  channel: NotificationChannel
}

export interface QuietHours {
  enabled: boolean
  start: string // 'HH:MM' wall-clock, no explicit timezone field on the setting itself
  end: string
}

export interface NotificationPreferences {
  activity: ActivityNotificationPref[]
  quiet_hours: QuietHours
}

export const ACTIVITY_NOTIF_DEFAULTS: ActivityNotificationPref[] = [
  { label: 'New ticket assigned to me', enabled: true, channel: 'in-app' },
  { label: 'Ticket status changed', enabled: true, channel: 'in-app' },
  { label: 'New deal created', enabled: false, channel: 'in-app' },
  { label: 'Deal stage changed', enabled: true, channel: 'in-app' },
  { label: 'Contract signed', enabled: true, channel: 'email+in-app' },
  { label: 'Invoice overdue', enabled: true, channel: 'email+in-app' },
  { label: 'Task assigned to me', enabled: true, channel: 'in-app' },
  { label: 'Task due today', enabled: true, channel: 'in-app' },
  { label: 'New form submission', enabled: true, channel: 'in-app' },
  { label: 'Proposal accepted/declined', enabled: true, channel: 'email+in-app' },
  { label: 'New contact created', enabled: false, channel: 'in-app' },
]

export const QUIET_HOURS_DEFAULTS: QuietHours = {
  enabled: false,
  start: '22:00',
  end: '08:00',
}

export const NOTIFICATION_PREFERENCES_DEFAULTS: NotificationPreferences = {
  activity: ACTIVITY_NOTIF_DEFAULTS,
  quiet_hours: QUIET_HOURS_DEFAULTS,
}

// Maps an automations-engine event key (the string passed to fireAutomations(),
// e.g. 'deal_stage_changed' — see TRIGGER_MAP in lib/automations-engine.ts) to
// the Activity Notifications label it corresponds to in Settings > Notifications.
// Only event keys with a real, unambiguous counterpart in that matrix are
// listed. Several matrix rows ('Ticket status changed', 'New deal created',
// 'Task assigned to me', 'Task due today') still have no corresponding
// event at all — nothing in the codebase fires a push for those today, so
// there's nothing to gate; they stay write-only until that push-sending
// code exists (out of scope for #406, which is specifically about the
// automations-engine push call sites).
//
// AUDIT.md #486 — 'ticket_created' is the one exception: POST
// /api/tickets now calls sendPushNotification() directly (not through
// fireAutomations()/automations-engine, since ticket auto-assignment isn't
// an automation) when applyRoutingRules() auto-assigns a new ticket, so
// 'New ticket assigned to me' has a real send to gate.
export const EVENT_TO_ACTIVITY_LABEL: Record<string, string> = {
  deal_stage_changed: 'Deal stage changed',
  contract_executed: 'Contract signed',
  contract_signed: 'Contract signed',
  invoice_overdue: 'Invoice overdue',
  form_submitted: 'New form submission',
  proposal_accepted: 'Proposal accepted/declined',
  proposal_declined: 'Proposal accepted/declined',
  contact_created: 'New contact created',
  ticket_created: 'New ticket assigned to me',
}

// Matches lib/settings.ts's own getSecuritySettings() cache tradeoff — a
// small in-memory TTL cache instead of a DB round trip on every automation
// action, at the cost of a saved preference taking up to CACHE_TTL_MS to
// take effect across server instances.
const CACHE_TTL_MS = 30_000
let cached: { value: NotificationPreferences; expiresAt: number } | null = null

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('notification_preferences')
      .eq('id', 'global')
      .maybeSingle()

    const raw = (data?.notification_preferences as Partial<NotificationPreferences>) ?? {}
    const value: NotificationPreferences = {
      activity: Array.isArray(raw.activity) && raw.activity.length
        ? raw.activity as ActivityNotificationPref[]
        : ACTIVITY_NOTIF_DEFAULTS,
      quiet_hours: { ...QUIET_HOURS_DEFAULTS, ...(raw.quiet_hours ?? {}) },
    }
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch {
    return NOTIFICATION_PREFERENCES_DEFAULTS
  }
}

// Whether a push notification should be sent for a given automations-engine
// event key, based purely on the Activity Notifications matrix (not Quiet
// Hours — see isWithinQuietHours below for that). An event with no entry in
// EVENT_TO_ACTIVITY_LABEL always sends, same as before this feature was
// wired up — there's no user-facing toggle for it to honor.
export function isPushAllowedForEvent(prefs: NotificationPreferences, eventKey: string | undefined): boolean {
  if (!eventKey) return true
  const label = EVENT_TO_ACTIVITY_LABEL[eventKey]
  if (!label) return true
  const pref = prefs.activity.find(a => a.label === label)
  if (!pref) return true
  if (!pref.enabled) return false
  // Only 'push' and 'push+email' actually include the push channel — 'in-app',
  // 'email+in-app' and 'muted' all mean "don't push" (in-app/email delivery for
  // those channels isn't implemented anywhere in the app yet; this only gates
  // the one real push-sending call site per AUDIT.md #406's scoping).
  return pref.channel === 'push' || pref.channel === 'push+email'
}

// A configured IANA zone is validated up front (Settings > Company's
// "Timezone" field is a free-text input, e.g. the UI's own default value
// 'America/New_York (ET)' is NOT a valid IANA identifier and would throw
// inside Intl) — falls back to lib/settings.ts's own DEFAULTS.company.timezone
// ('America/Chicago') rather than letting a bad string crash the send path.
function safeTimeZone(tz: string | undefined): string {
  const candidate = (tz ?? '').trim()
  if (candidate) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: candidate })
      return candidate
    } catch { /* not a valid IANA zone — fall through to the default below */ }
  }
  return 'America/Chicago'
}

// Quiet Hours has no explicit timezone field of its own (see QuietHours
// above) — Settings > Company's single business timezone
// (app_settings.company.timezone, read via getSettings()) is the only
// timezone concept this app tracks outside of per-feature settings like
// booking pages, so it's what Quiet Hours is interpreted against.
export function isWithinQuietHours(quietHours: QuietHours, timezone: string | undefined, now: Date = new Date()): boolean {
  if (!quietHours.enabled) return false
  const tz = safeTimeZone(timezone)
  const { time } = dateAndTimeInZone(now, tz)
  const [nowH, nowM] = time.split(':').map(Number)
  const nowMinutes = nowH * 60 + nowM

  const [startH, startM] = quietHours.start.split(':').map(Number)
  const [endH, endM] = quietHours.end.split(':').map(Number)
  if ([startH, startM, endH, endM].some(n => Number.isNaN(n))) return false
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes === endMinutes) return false // zero-length window — misconfigured, never treat as "all day"
  if (startMinutes < endMinutes) {
    // Same-day window, e.g. 09:00-17:00
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }
  // Overnight window, e.g. 22:00-08:00
  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

// Single entry point automations-engine.ts calls right before each real
// push send. Suppresses (does not queue) — this codebase has no existing
// "deliver after quiet hours" queue/scheduler for push notifications to hook
// into (Wait actions schedule automation resumes, not notification delivery),
// so suppressing is the simpler option and avoids inventing a new delivery
// queue for a MEDIUM-severity gap; see AUDIT.md #406.
export async function shouldSendPushForEvent(eventKey: string | undefined): Promise<boolean> {
  const prefs = await getNotificationPreferences()
  if (!isPushAllowedForEvent(prefs, eventKey)) return false
  const settings = await getSettings()
  if (isWithinQuietHours(prefs.quiet_hours, settings.company.timezone)) return false
  return true
}
