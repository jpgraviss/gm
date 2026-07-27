import * as Sentry from "@sentry/nextjs";

// AUDIT — lib/api-handler.ts's withErrorHandler captures every unhandled
// route error with `extra: { url: req.url }`. This only ever stripped
// request.cookies/headers, not that URL — so any route that puts a
// credential into its own query string (e.g. app/api/inbox/unified's
// gmailToken) leaked it here on any transient/unrelated error.
const SENSITIVE_QUERY_PARAMS = ['token', 'key', 'secret', 'password', 'code']

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    for (const name of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.some(p => name.toLowerCase().includes(p))) {
        parsed.searchParams.set(name, '[redacted]')
      }
    }
    return parsed.toString()
  } catch {
    return url
  }
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    // Strip sensitive data before sending to Sentry
    if (event.request) {
      delete event.request.cookies
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
    }
    if (event.extra?.url && typeof event.extra.url === 'string') {
      event.extra.url = redactUrl(event.extra.url)
    }
    return event
  },
});
