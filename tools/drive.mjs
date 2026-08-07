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
  const onConsole = m => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 140)}`) }
  page.on('pageerror', onErr); page.on('console', onConsole)

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
  for (const e of errs.slice(0, 3)) console.log(`      ${e}`)

  page.off('pageerror', onErr); page.off('console', onConsole)
}

console.log(`\npages with a bounce or error: ${failures}/${PAGES.length}`)
await browser.close()
