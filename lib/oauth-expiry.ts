/**
 * 6-month re-auth policy for advertising/marketing OAuth connections.
 *
 * AUDIT #656 — this doc comment used to claim the policy covered "every
 * OAuth-backed integration (Google Calendar, Drive, Gmail, Marketing
 * products, Meta Ads)". It never did: only `lib/google-marketing.ts` and
 * `lib/meta-ads.ts` call into this module. Calendar, Drive, and Gmail have
 * never been subject to it. The claim is corrected here rather than
 * extended, deliberately — see below.
 *
 * WHAT ENFORCES IT (verified by grep of `isWithinReauthWindow` callers):
 *   - lib/google-marketing.ts — Search Console, Analytics 4, Ads, Business Profile
 *   - lib/meta-ads.ts
 * Both are workspace-level, staff-initiated connections whose failure mode
 * on expiry is a visible "reconnect" prompt in the Integrations UI.
 *
 * WHAT DOESN'T, AND WHY (a deliberate decision, not an oversight):
 *   - Google Calendar (lib/google-calendar.ts) drives an UNATTENDED cron
 *     sync. A policy-forced expiry would silently stop syncing real client
 *     bookings until someone noticed and reconnected — a worse failure mode
 *     for a single trusted internal team than the stale-token risk it
 *     mitigates. Neither it nor Drive even stores a `connected_at`, so
 *     enforcing this would also require a schema change.
 *   - Google Drive (lib/google-drive.ts) — same, workspace-level and
 *     background-read.
 *   - Gmail is per-user and browser-based: its access already expires
 *     roughly hourly and requires a manual reconnect (see the note in
 *     app/settings/page.tsx), so a 180-day ceiling adds nothing.
 *
 * The real mitigation for the departing-employee case those integrations
 * care about is revoking the person's GravHub access (which cuts off the
 * app-side path to their tokens) and disconnecting the integration in
 * Admin → Integrations — not a timer.
 */

export const REAUTH_WINDOW_DAYS = 180
const REAUTH_WINDOW_MS = REAUTH_WINDOW_DAYS * 24 * 60 * 60 * 1000

/**
 * Returns true if the connection is still within the 180-day window.
 * A missing `connectedAt` is treated as valid (legacy connections).
 */
export function isWithinReauthWindow(connectedAt: Date | string | null | undefined): boolean {
  if (!connectedAt) return true
  const ts = connectedAt instanceof Date ? connectedAt.getTime() : new Date(connectedAt).getTime()
  if (Number.isNaN(ts)) return true
  return Date.now() - ts < REAUTH_WINDOW_MS
}

/**
 * Returns the date when a connection should be re-authorized.
 */
export function reauthDueDate(connectedAt: Date | string | null | undefined): Date | null {
  if (!connectedAt) return null
  const ts = connectedAt instanceof Date ? connectedAt.getTime() : new Date(connectedAt).getTime()
  if (Number.isNaN(ts)) return null
  return new Date(ts + REAUTH_WINDOW_MS)
}

/**
 * Days remaining until re-authorization is required. Negative if overdue.
 */
export function daysUntilReauth(connectedAt: Date | string | null | undefined): number {
  const due = reauthDueDate(connectedAt)
  if (!due) return Infinity
  return Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}
