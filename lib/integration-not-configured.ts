/**
 * "This integration has not been set up" — a configuration state, not a fault.
 *
 * AUDIT #778. Every optional integration resolves its credentials by throwing
 * a bare `Error` when they are absent: `MAVERICK_API_KEY not set`,
 * `LINKEDIN_CLIENT_ID not configured`, `RESEND_API_KEY is not configured`,
 * and so on. `withErrorHandler` cannot tell those from a genuine failure, so
 * they became 500s, and two things followed:
 *
 *  - In production the handler replaces the message with "Internal server
 *    error" (deliberately — thrown text often carries DB detail or variable
 *    names). So the one audience who could act on "Maverick isn't configured"
 *    is the only one who never sees it. The Visitor Intelligence page reports
 *    three internal server errors on load for any deployment not using
 *    Maverick, with nothing to distinguish "not set up" from "broken".
 *  - Every one of those page loads reports an exception to Sentry, so a
 *    deliberate configuration choice generates a permanent stream of alerts.
 *
 * Throwing this instead keeps the message (it names an integration, never
 * internal detail), answers 503 rather than 500, and stays out of Sentry.
 *
 * Found by the browser harness (tools/), which surfaced the three 500s on
 * `/intelligence` in a crawl.
 */

export const NOT_CONFIGURED = 'NOT_CONFIGURED' as const

export class NotConfiguredError extends Error {
  /**
   * Structural marker rather than relying on `instanceof` alone. Server and
   * client bundles can each end up with their own copy of a module, and a
   * prototype check across that boundary silently returns false — which here
   * would mean quietly falling back to the 500 this exists to prevent.
   */
  readonly code = NOT_CONFIGURED
  readonly integration: string

  constructor(integration: string, message?: string) {
    super(message ?? `${integration} is not configured`)
    this.name = 'NotConfiguredError'
    this.integration = integration
  }
}

export function isNotConfigured(err: unknown): err is NotConfiguredError {
  return (
    err instanceof NotConfiguredError ||
    (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === NOT_CONFIGURED)
  )
}
