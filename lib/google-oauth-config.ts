import { NotConfiguredError } from '@/lib/integration-not-configured'

/**
 * One place that decides where Google sends users back to.
 *
 * AUDIT #784. Four Google OAuth flows each built their redirect URI their own
 * way, with three different fallbacks between them:
 *
 *   calendar   process.env.GOOGLE_REDIRECT_URI          (a different variable
 *                                                        entirely, no fallback)
 *   gmail      `${NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/gmail/callback`
 *   drive      `${NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/drive/callback`
 *   marketing  `${NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'}/…`
 *
 * Google matches `redirect_uri` against its registered list byte for byte, so
 * each variant has to be registered separately and each fails on its own. The
 * localhost fallbacks are the worst of it: with `NEXT_PUBLIC_APP_URL` unset in
 * production, Gmail and Drive quietly ask Google to send the user to
 * `http://localhost:3000`, and the only symptom is Google's own
 * `redirect_uri_mismatch` screen — nothing in this app logs a thing, because
 * from its side the request succeeded.
 *
 * Everything now derives from one base URL, and an unset one is an error
 * rather than a guess. Guessing is what made this take an afternoon to see.
 */

/** Each flow's path. Register every one of these in Google Cloud Console. */
export const GOOGLE_CALLBACK_PATHS = {
  calendar:  '/api/calendar/callback',
  gmail:     '/api/gmail/callback',
  drive:     '/api/drive/callback',
  marketing: '/api/integrations/google-marketing/callback',
} as const

export type GoogleOAuthFlow = keyof typeof GOOGLE_CALLBACK_PATHS

/**
 * The public origin this deployment is reachable on.
 *
 * `NEXT_PUBLIC_APP_URL` is the single source. In development an unset value
 * falls back to localhost, which is right there and wrong everywhere else —
 * hence the production guard.
 */
export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  if (raw) return raw.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new NotConfiguredError(
      'Google',
      'NEXT_PUBLIC_APP_URL is not set, so this server cannot tell Google where to send users back to. Set it to this deployment\'s public URL (for example https://app.gravissmarketing.com) and redeploy.',
    )
  }
  return 'http://localhost:3000'
}

/**
 * Where Google should return to for a given flow.
 *
 * `GOOGLE_REDIRECT_URI` is still honoured for the calendar flow so an existing
 * deployment that set it keeps working, but it is no longer required: with it
 * unset the URI is derived like every other flow's.
 */
export function googleRedirectUri(flow: GoogleOAuthFlow): string {
  if (flow === 'calendar' && process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI
  }
  return `${appBaseUrl()}${GOOGLE_CALLBACK_PATHS[flow]}`
}

/**
 * Throws a `NotConfiguredError` naming exactly what is missing.
 *
 * Previously a missing client id surfaced as a raw `Error`, which
 * `withErrorHandler` turns into a 500 — and in production it replaces the
 * message with "Internal server error". So the one person who could fix it
 * saw the least useful sentence available. See AUDIT #778.
 */
export function assertGoogleOAuthConfigured(): void {
  const missing: string[] = []
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
  if (missing.length) {
    throw new NotConfiguredError(
      'Google',
      `Google is not configured on this server: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set. Add ${missing.length > 1 ? 'them' : 'it'} to the deployment's environment variables and redeploy.`,
    )
  }
  // Surfaces the NEXT_PUBLIC_APP_URL problem here rather than as a
  // redirect_uri_mismatch on Google's screen, where this app never sees it.
  appBaseUrl()
}

/**
 * What the deployment currently resolves to, for the Integrations screen.
 * Never throws — its whole job is to describe a broken configuration.
 */
export function googleOAuthDiagnostics(): {
  clientIdSet: boolean
  clientSecretSet: boolean
  appUrlSet: boolean
  baseUrl: string | null
  redirectUris: Record<GoogleOAuthFlow, string> | null
  legacyCalendarRedirectUri: string | null
  problems: string[]
} {
  const clientIdSet = !!process.env.GOOGLE_CLIENT_ID
  const clientSecretSet = !!process.env.GOOGLE_CLIENT_SECRET
  const appUrlSet = !!process.env.NEXT_PUBLIC_APP_URL
  const problems: string[] = []
  if (!clientIdSet) problems.push('GOOGLE_CLIENT_ID is not set')
  if (!clientSecretSet) problems.push('GOOGLE_CLIENT_SECRET is not set')
  if (!appUrlSet) problems.push('NEXT_PUBLIC_APP_URL is not set — redirect URIs cannot be derived')

  let baseUrl: string | null = null
  let redirectUris: Record<GoogleOAuthFlow, string> | null = null
  try {
    baseUrl = appBaseUrl()
    redirectUris = Object.fromEntries(
      (Object.keys(GOOGLE_CALLBACK_PATHS) as GoogleOAuthFlow[]).map(f => [f, googleRedirectUri(f)]),
    ) as Record<GoogleOAuthFlow, string>
  } catch { /* described by `problems` above */ }

  const legacy = process.env.GOOGLE_REDIRECT_URI ?? null
  if (legacy && baseUrl && legacy !== `${baseUrl}${GOOGLE_CALLBACK_PATHS.calendar}`) {
    problems.push(
      `GOOGLE_REDIRECT_URI (${legacy}) does not match the derived calendar callback ` +
      `(${baseUrl}${GOOGLE_CALLBACK_PATHS.calendar}). Both must be registered in Google Cloud Console, ` +
      'or unset GOOGLE_REDIRECT_URI to use the derived one.',
    )
  }

  return { clientIdSet, clientSecretSet, appUrlSet, baseUrl, redirectUris, legacyCalendarRedirectUri: legacy, problems }
}
