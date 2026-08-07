/**
 * Drives the real app in a browser as the seeded admin and reports what
 * breaks. Run with the fake Supabase and `next dev` already up:
 *
 *   node tools/fake-supabase.mjs 54321 &
 *   npm run dev &
 *   HARNESS_COOKIE=$(SESSION_SIGNING_KEY=... node tools/mint-session.mjs) \
 *     node tools/drive.mjs
 *
 * Reports, per page: where it ended up, whether seeded data actually
 * rendered, and any console/page/network error. A page that loads but shows
 * none of its data is the failure this is for — that is invisible to a 200.
 *
 * Env:
 *   HARNESS_PAGES  comma-separated routes, overriding the derived list
 *   HARNESS_DELAY  ms to wait between pages (default 400). The app
 *                  rate-limits its own API routes, and a fast crawl over
 *                  ~60 pages trips it; 429s are the harness's own fault, not
 *                  a finding, so they are counted separately.
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { staticRoutes, dynamicRoutes } from './routes.mjs'

const COOKIE = process.env.HARNESS_COOKIE
const BASE = 'http://localhost:3000'
const DELAY = Number(process.env.HARNESS_DELAY ?? 400)
if (!COOKIE) { console.error('HARNESS_COOKIE not set'); process.exit(1) }

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf-8'))
const dyn = dynamicRoutes(fixtures)
const PAGES = process.env.HARNESS_PAGES?.split(',') ?? [...staticRoutes(), ...dyn.routes]

/**
 * Strings from tools/fixtures.json that should surface if data rendered.
 *
 * Deliberately excludes the signed-in user's own name. `Jonathan Graviss` is
 * rendered by the app shell — sidebar, header, avatar — on every single page,
 * so matching it made `data:yes` mean "the shell rendered", which is true
 * even of a page showing nothing at all. Text is read from <main> for the
 * same reason.
 */
const SEEDED = /Acme Industrial|Maya Chen|Brightwater|INV-100|Owen Patel/

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext()
await ctx.addCookies([{ name: 'gravhub-auth', value: COOKIE, domain: 'localhost', path: '/' }])

// The browser client reads its session from localStorage, not the cookie.
const session = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'tm-jonathan', email: 'jonathangraviss@gmail.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
}
await ctx.addInitScript(s => {
  try { localStorage.setItem('sb-127-auth-token', JSON.stringify(s)) } catch { /* ignore */ }
}, session)

const page = await ctx.newPage()
let failures = 0
let throttled = 0
const summary = []

/** Not findings: unreachable in this sandbox, or the crawl's own doing. */
const isNoise = e =>
  /accounts\.google\.com/.test(e) ||   // Google Sign-In script, no outbound here
  /^http 429:/.test(e)                // our own crawl rate-limiting the app

for (const route of PAGES) {
  const errs = []
  const onErr = e => errs.push(`pageerror: ${e.message.slice(0, 140)}`)
  // "Failed to load resource" from the console never names the URL, which
  // makes it unactionable — the same line covers a 400 on one endpoint and a
  // dead socket on another. Report failures from the network events instead,
  // which do carry the URL, and drop the console's duplicate of them.
  const onConsole = m => {
    const text = m.text()
    if (m.type() !== 'error') return
    if (/Failed to load resource/.test(text)) return
    errs.push(`console: ${text.slice(0, 140)}`)
  }
  const short = u => u.replace(BASE, '').replace('http://127.0.0.1:54321', 'sb:').slice(0, 90)
  const onFailed = r => errs.push(`neterr ${r.failure()?.errorText ?? '?'}: ${short(r.url())}`)
  const onResponse = r => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${short(r.url())}`) }
  page.on('pageerror', onErr); page.on('console', onConsole)
  page.on('requestfailed', onFailed); page.on('response', onResponse)

  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)

  const landed = new URL(page.url()).pathname
  // <main> excludes the shell, so this measures the page's own content.
  const body = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ')
  const bounced = landed === '/login'
  const hasData = SEEDED.test(body)

  const real = [...new Set(errs)].filter(e => !isNoise(e))
  if (errs.some(e => /^http 429:/.test(e))) throttled++
  const bad = bounced || real.length > 0
  if (bad) failures++

  const line =
    `${route.padEnd(26)} -> ${landed.padEnd(26)} ` +
    `${bounced ? 'BOUNCED ' : hasData ? 'data:yes' : 'data:no '} ` +
    `chars=${String(body.length).padStart(5)} errs=${real.length}`
  console.log(line)
  for (const e of real.slice(0, 6)) console.log(`      ${e}`)
  summary.push({ route, landed, bounced, hasData, chars: body.length, errs: real })

  page.off('pageerror', onErr); page.off('console', onConsole)
  page.off('requestfailed', onFailed); page.off('response', onResponse)
  if (DELAY) await page.waitForTimeout(DELAY)
}

console.log(`\npages with a bounce or error: ${failures}/${PAGES.length}`)
if (!process.env.HARNESS_PAGES) {
  // Coverage gaps are reported, never hidden: a detail page nobody drives
  // looks identical to one that passes.
  if (dyn.unmapped.length) console.log(`\ndynamic routes with no fixture mapping (not crawled): ${dyn.unmapped.join(', ')}`)
  if (dyn.empty.length) console.log(`dynamic routes whose fixture table is empty (not crawled): ${dyn.empty.join(', ')}`)
}
if (throttled) {
  console.log(`${throttled} page(s) saw a 429 — that is this crawl rate-limiting the app, not a finding. Raise HARNESS_DELAY to confirm a result on those.`)
}
const empty = summary.filter(s => !s.bounced && s.chars < 400)
if (empty.length) {
  console.log(`\nsuspiciously empty (<400 chars of <main>): ${empty.map(s => s.route).join(', ')}`)
}
await browser.close()
