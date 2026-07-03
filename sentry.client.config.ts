import * as Sentry from "@sentry/nextjs";

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('gravhub_cookie_consent') === 'accepted'
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: hasConsent() ? 0.1 : 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: hasConsent() ? 1.0 : 0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
