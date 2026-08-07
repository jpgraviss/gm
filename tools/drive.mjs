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
 * rendered, and any console/page errors. A page that loads but shows none
 * of its data is the failure this is for — that is invisible to a 200.
 */
import { chromium } from 'playwright-core'

const COOKIE = process.env.HARNESS_COOKIE
const BASE = 'http://localhost:3000'
if (!COOKIE) { console.error('HARNESS_COOKIE not set'); process.exit(1) }

const PAGES = process.env.HARNESS_PAGES?.split(',') ?? [
  '/', '/crm/contacts', '/crm/companies', '/crm/pipeline', '/billing',
  '/contracts', '/projects', '/tasks', '/tickets', '/time-tracking',
  '/finance', '/reports', '/automation', '/knowledge-base', '/admin',
]

/** Strings from tools/fixtures.json that should surface if data rendered. */
const SEEDED = /Acme Industrial|Maya Chen|Brightwater|INV-100|Owen Patel|Jonathan Graviss/

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
  const short = u => u.replace('http://localhost:3000', '').replace('http://127.0.0.1:54321', 'sb:').slice(0, 90)
  const onFailed = r => errs.push(`neterr ${r.failure()?.errorText ?? '?'}: ${short(r.url())}`)
  const onResponse = r => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${short(r.url())}`) }
  page.on('pageerror', onErr); page.on('console', onConsole)
  page.on('requestfailed', onFailed); page.on('response', onResponse)

  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3500)

  const landed = new URL(page.url()).pathname
  const body = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ')
  const bounced = landed === '/login'
  const hasData = SEEDED.test(body)
  const bad = bounced || errs.length > 0
  if (bad) failures++

  console.log(
    `${route.padEnd(17)} -> ${landed.padEnd(17)} ` +
    `${bounced ? 'BOUNCED ' : hasData ? 'data:yes' : 'data:no '} ` +
    `chars=${String(body.length).padStart(5)} errs=${errs.length}`
  )
  // Dedupe — a retrying fetch reports the same failure many times over.
  for (const e of [...new Set(errs)].slice(0, 6)) console.log(`      ${e}`)

  page.off('pageerror', onErr); page.off('console', onConsole)
  page.off('requestfailed', onFailed); page.off('response', onResponse)
}

console.log(`\npages with a bounce or error: ${failures}/${PAGES.length}`)
await browser.close()
