/**
 * 6-month re-auth policy for all OAuth connections.
 *
 * Every OAuth-backed integration (Google Calendar, Drive, Gmail, Marketing
 * products, Meta Ads) must be re-consented every 180 days.
 * The refresh token keeps working inside the window; after 180 days, the
 * library layer treats the connection as expired regardless of refresh
 * token validity and the user has to click "Connect" again.
 *
 * Why: security compliance (force periodic re-consent so an employee who
 * leaves the company can't leave stale OAuth tokens active forever) and
 * Google Security Assessment requirements for sensitive scopes.
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
