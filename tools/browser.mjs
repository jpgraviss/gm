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
