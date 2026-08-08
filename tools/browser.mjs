/**
 * The one place that knows how to open an authenticated browser against the
 * local app, and what counts as a real error once it is open.
 *
 * `drive.mjs` (crawl every route) and `interact.mjs` (drive real user actions)
 * both need exactly this, and they need it to agree: two copies of the session
 * setup means one of them can drift into signing in differently from the
 * other, and the symptom of that is a page "failing" in one tool and passing
 * in the other for reasons that have nothing to do with the app.
 */
import { chromium } from 'playwright-core'

export const BASE = process.env.HARNESS_BASE ?? 'http://localhost:3000'

const CHROME = process.env.HARNESS_CHROME
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

/** The seeded admin in `fixtures.json`. Only ever an identity — nothing is sent to it. */
export const HARNESS_USER = { id: 'tm-jonathan', email: 'jonathangraviss@gmail.com' }

/**
 * A browser signed in as the seeded admin.
 *
 * Two credentials, because the app reads two: the server trusts the signed
 * `gravhub-auth` cookie, and the browser-side Supabase client reads its
 * session from localStorage. Setting only one gets you a page that renders
 * from the server and then blanks itself, or the reverse — both look like
 * application bugs and neither is.
 */
export async function openSession(cookie = process.env.HARNESS_COOKIE) {
  if (!cookie) { console.error('HARNESS_COOKIE not set'); process.exit(1) }

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
  const ctx = await browser.newContext()
  await ctx.addCookies([{ name: 'gravhub-auth', value: cookie, domain: 'localhost', path: '/' }])

  const session = {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { ...HARNESS_USER, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
  }
  await ctx.addInitScript(s => {
    try { localStorage.setItem('sb-127-auth-token', JSON.stringify(s)) } catch { /* ignore */ }
  }, session)

  const page = await ctx.newPage()

  // Several destructive actions gate on `confirm('Delete this task?')`. Nothing
  // handles the dialog by default, so the click that opens it never returns and
  // the step fails as a timeout with no hint that a dialog is why. Accepting is
  // right here: a scenario that reaches a confirm meant to reach it.
  page.on('dialog', d => { d.accept().catch(() => {}) })

  return { browser, ctx, page }
}

/** Shortens a URL for a log line: strips the origin, names the fake Supabase. */
export const shortUrl = u =>
  String(u).replace(BASE, '').replace('http://127.0.0.1:54321', 'sb:').slice(0, 90)

/**
 * Not findings: unreachable in this sandbox, or the harness's own doing.
 *
 * 429s are the second kind. The app rate-limits its own API routes and a fast
 * run trips it, so a 429 says something about the pace of the run and nothing
 * about the app.
 */
export const isNoise = e =>
  /accounts\.google\.com/.test(e) ||
  /^http 429:/.test(e) ||
  // Auto-enrichment fetches the contact's own domain over the internet. The
  // harness types an RFC 2606 `.invalid` address on purpose, so this route
  // returning 4xx is it working: there is nothing there to fetch, and the
  // sandbox has no outbound DNS to find out with either. Narrow to this one
  // route rather than 4xx generally — everywhere else a 4xx is the finding.
  /^http 4\d\d: \/api\/crm\/enrich/.test(e) ||
  // `next dev` serves its own fonts and cancels the request when the page
  // navigates away mid-load. Nothing in the app fetches these.
  /__nextjs_font/.test(e)

/**
 * Keeps the harness under the app's own rate limit instead of tripping it.
 *
 * `proxy.ts` allows 200 API requests per minute per IP. One page load here
 * costs ten to twenty, so a run that drives several pages crosses it, and the
 * result is not an error the harness can read: the limiter answers 429, the
 * page's fetch resolves to nothing, and the list renders empty. That is
 * indistinguishable from the write never happening — which is the exact thing
 * the harness exists to detect, so it must not be able to fake it.
 *
 * Backing off *after* a 429 does not work either, because the window is 60s
 * and the limiter keeps refusing for the rest of it. Staying under the budget
 * is the only version that holds: count what we send, and pause before the
 * next burst when the last minute is nearly full.
 */
export function watchRateLimit(page, { limit = 200, windowMs = 60_000 } = {}) {
  const sent = []
  const onRequest = r => {
    // `/api/:path*` is `proxy.ts`'s matcher, so only those requests are
    // counted by the limiter. Counting page chunks and RSC payloads too would
    // put the harness three or four times over its real usage and make it wait
    // for windows that were never full.
    if (r.url().startsWith(`${BASE}/api/`)) sent.push(Date.now())
  }
  page.on('request', onRequest)

  const recent = () => {
    const cutoff = Date.now() - windowMs
    while (sent.length && sent[0] < cutoff) sent.shift()
    return sent.length
  }

  return {
    used: recent,
    /**
     * Waits until at least `headroom` requests are free in the window.
     *
     * Headroom rather than the raw limit because the next page load spends its
     * whole share in a couple of seconds, long before anything ages out.
     *
     * The wait is timed off the *last* entry that has to expire, not the first.
     * Waiting for the oldest one frees exactly one slot, so a caller over
     * budget by fifty would wait a full window and still be over — which is
     * how the first version of this stalled a run indefinitely without ever
     * looking stuck.
     */
    async throttle(headroom = 60) {
      const target = limit - headroom
      if (recent() <= target) return 0
      const mustExpire = recent() - target
      const waitMs = Math.max(0, windowMs - (Date.now() - sent[mustExpire - 1])) + 500
      await page.waitForTimeout(waitMs)
      return waitMs
    },
    stop() { page.off('request', onRequest) },
  }
}

/**
 * Tracks writes in flight, so a run can wait for the app to finish saving.
 *
 * Nothing in this app awaits its own mutations before returning — the handlers
 * fire `fetch(...)` and update React state optimistically. Navigating on a
 * fixed timer therefore races them, and a navigation cancels an in-flight
 * request: the DELETE never reaches the server, the browser reports
 * `net::ERR_ABORTED`, and the row is still there on reload. That reads exactly
 * like "delete does not persist", which is a real bug this harness is supposed
 * to be able to find — so the harness must not be able to manufacture it.
 */
export function watchWrites(page) {
  const inFlight = new Set()
  const isWrite = r => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method())
  const onRequest = r => { if (isWrite(r)) inFlight.add(r) }
  const settle = r => inFlight.delete(r)

  page.on('request', onRequest)
  page.on('requestfinished', settle)
  page.on('requestfailed', settle)

  return {
    /** Resolves when no write is outstanding, or after `timeout` either way. */
    async idle(timeout = 8000) {
      const deadline = Date.now() + timeout
      while (inFlight.size && Date.now() < deadline) await page.waitForTimeout(100)
      return inFlight.size === 0
    },
    stop() {
      page.off('request', onRequest)
      page.off('requestfinished', settle)
      page.off('requestfailed', settle)
    },
  }
}

/**
 * Collects console, page, and network errors until you stop it.
 *
 * The console's "Failed to load resource" is dropped deliberately: it never
 * names the URL, so the same unactionable line covers a 400 on one endpoint
 * and a dead socket on another. The network events carry the URL, so failures
 * are reported from those instead.
 */
export function watchErrors(page) {
  const errors = []
  const onErr = e => errors.push(`pageerror: ${e.message.slice(0, 140)}`)
  const onConsole = m => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (/Failed to load resource/.test(text)) return
    errors.push(`console: ${text.slice(0, 140)}`)
  }
  const onFailed = r => errors.push(`neterr ${r.failure()?.errorText ?? '?'}: ${shortUrl(r.url())}`)
  const onResponse = r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${shortUrl(r.url())}`) }

  page.on('pageerror', onErr)
  page.on('console', onConsole)
  page.on('requestfailed', onFailed)
  page.on('response', onResponse)

  return {
    errors,
    /** Unique, noise removed, in the order they happened. */
    real: () => [...new Set(errors)].filter(e => !isNoise(e)),
    throttled: () => errors.some(e => /^http 429:/.test(e)),
    stop() {
      page.off('pageerror', onErr)
      page.off('console', onConsole)
      page.off('requestfailed', onFailed)
      page.off('response', onResponse)
    },
  }
}
