import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { GOOGLE_CALLBACK_PATHS, googleRedirectUri, appBaseUrl } from '@/lib/google-oauth-config'

/**
 * Every Google OAuth redirect URI comes from one place.
 *
 * AUDIT #784. Four flows each built their own, with three different fallbacks:
 * calendar read a separate `GOOGLE_REDIRECT_URI` variable, gmail and drive fell
 * back to `http://localhost:3000`, marketing to the production domain. Google
 * matches `redirect_uri` byte for byte against its registered list, so each
 * variant has to be registered separately and each fails on its own.
 *
 * The localhost fallbacks were the dangerous part. With `NEXT_PUBLIC_APP_URL`
 * unset in production, Gmail and Drive quietly asked Google to send the user
 * back to localhost. That fails on Google's own screen — this app never sees
 * the request, logs nothing, and reports nothing. "It just doesn't connect."
 *
 * A guard rather than a fix alone because the failure is invisible from
 * inside: no exception, no 500, no Sentry event. The only way to notice is to
 * try connecting and read Google's error, which is exactly what took an
 * afternoon.
 */

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('Google redirect URIs (AUDIT #784)', () => {
  const original = { ...process.env }
  beforeEach(() => { process.env = { ...original } })
  afterEach(() => { process.env = original; vi.unstubAllEnvs() })

  it('derives every flow from one base URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test'
    delete process.env.GOOGLE_REDIRECT_URI
    expect(googleRedirectUri('calendar')).toBe('https://example.test/api/calendar/callback')
    expect(googleRedirectUri('gmail')).toBe('https://example.test/api/gmail/callback')
    expect(googleRedirectUri('drive')).toBe('https://example.test/api/drive/callback')
    expect(googleRedirectUri('marketing')).toBe('https://example.test/api/integrations/google-marketing/callback')
  })

  it('tolerates a trailing slash on the base URL', () => {
    // Google compares byte for byte, so `https://x//api/...` is a different
    // URI from `https://x/api/...` and would fail to match.
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test/'
    delete process.env.GOOGLE_REDIRECT_URI
    expect(googleRedirectUri('gmail')).toBe('https://example.test/api/gmail/callback')
  })

  it('still honours GOOGLE_REDIRECT_URI for calendar, so existing deployments keep working', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.test'
    process.env.GOOGLE_REDIRECT_URI = 'https://legacy.test/api/calendar/callback'
    expect(googleRedirectUri('calendar')).toBe('https://legacy.test/api/calendar/callback')
    // ...and does not leak into the other three.
    expect(googleRedirectUri('gmail')).toBe('https://example.test/api/gmail/callback')
  })

  it('refuses to guess a base URL in production', () => {
    // The regression: this used to return http://localhost:3000, which Google
    // rejects with redirect_uri_mismatch on its own screen — invisible here.
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => appBaseUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('falls back to localhost only outside production', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.stubEnv('NODE_ENV', 'development')
    expect(appBaseUrl()).toBe('http://localhost:3000')
  })

  it('no Google OAuth call site builds its own redirect URI', () => {
    const offenders: string[] = []
    for (const dir of ['app', 'lib', 'components']) {
      for (const file of walk(join(root, dir))) {
        const rel = file.slice(root.length + 1)
        // The helper itself, and the health endpoint, which *reports* whether
        // GOOGLE_REDIRECT_URI is set rather than building a URI from it —
        // diagnostics naming a variable are the opposite of the bug here.
        if (rel === 'lib/google-oauth-config.ts') continue
        if (rel === 'app/api/auth/health/route.ts') continue
        readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
          // Comments at the repaired sites quote the old expression.
          if (/^\s*(\/\/|\/?\*)/.test(line.trim())) return
          // An app-URL template ending in one of the known callback paths.
          const paths = Object.values(GOOGLE_CALLBACK_PATHS).map(p => p.replace(/\//g, '\\/'))
          const re = new RegExp(`NEXT_PUBLIC_APP_URL[^\`\\n]*(${paths.join('|')})`)
          if (re.test(line)) offenders.push(`${rel}:${i + 1}`)
          // ...or a raw read of the legacy calendar variable outside the helper.
          if (/process\.env\.GOOGLE_REDIRECT_URI/.test(line)) offenders.push(`${rel}:${i + 1} (GOOGLE_REDIRECT_URI)`)
        })
      }
    }
    expect(offenders, `use googleRedirectUri() from lib/google-oauth-config:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the callback path map matches the routes that actually exist', () => {
    // A path here that no route serves would be registered in Google Cloud
    // Console and then 404 — worse than missing, because it looks configured.
    for (const [flow, path] of Object.entries(GOOGLE_CALLBACK_PATHS)) {
      const routeFile = join(root, 'app', `${path}/route.ts`)
      expect(() => statSync(routeFile), `${flow} → ${path} has no route file`).not.toThrow()
    }
  })
})
