/**
 * Drives real user actions — clicks a button, fills a form, submits it — and
 * checks the result survived a reload.
 *
 * `drive.mjs` proves 78 routes render. It never touches anything, so every
 * write path in the app is unverified end to end: a form that posts nothing,
 * a route that 500s on save, a field the API quietly drops. All three look
 * identical to a crawl, because the page they live on renders perfectly.
 *
 *   node tools/fake-supabase.mjs 54321 &
 *   npm run dev &
 *   HARNESS_COOKIE=$(SESSION_SIGNING_KEY=... node tools/mint-session.mjs) \
 *     node tools/interact.mjs
 *
 * Env:
 *   HARNESS_ONLY   substring; run only scenarios whose name contains it
 *   HARNESS_DELAY  ms between scenarios (default 1500) — the app rate-limits
 *                  its own API routes and a fast run trips it. A 429 rarely
 *                  surfaces as a 429: it surfaces as a dropdown with nothing
 *                  in it, or a list that renders empty.
 *
 * ## The reload is the point
 *
 * Every scenario asserts against a **fresh navigation**, not the screen it
 * just acted on. Almost every list in this app updates optimistically —
 * `setRows(prev => [created, ...prev])` — so the new row appears whether or
 * not anything was persisted. Asserting on the post-click screen would pass
 * against a POST that 500s, which is precisely the bug worth catching. AUDIT
 * #294 was a whole family of these.
 *
 * ## The cookie banner is left undismissed on purpose
 *
 * A returning user has accepted or declined and never sees it again, so it
 * would be easy to seed that consent here and make every scenario simpler.
 * Don't. A first-time visitor is the strictly harder case, and the first run
 * of this file found that the banner — `z-[9999]`, full width, pinned to the
 * bottom — sat on top of the Add Keyword modal's footer and made the submit
 * button unclickable (AUDIT #785). Seeding consent would have hidden that.
 *
 * ## What a failure means
 *
 * A scenario reports the step it died on, plus every console/network error
 * seen during the run. Read the network errors first: a 4xx on the API route
 * says the app asked for something the server refused, which is a real
 * finding; a 500 from `fake-supabase` usually says the fake does not model
 * something, which is not. See tools/README.md — the fake has manufactured
 * four phantom bugs so far, and every one was a difference between it and
 * PostgREST rather than a defect in the app.
 */
import { openSession, watchErrors, watchWrites, watchRateLimit, BASE } from './browser.mjs'

const DELAY = Number(process.env.HARNESS_DELAY ?? 1500)
const ONLY = process.env.HARNESS_ONLY
const ACT_TIMEOUT = 10000

/** A value nothing else in the fixtures can collide with, so a match is proof. */
const stamp = () => `harness-${Math.random().toString(36).slice(2, 8)}`

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * `run` performs the action and returns whatever identifies what it touched.
 * `persists` turns that into text that must be on the page after a fresh
 * navigation back to `route`; `absent` into text that must *not* be. Give one
 * or the other — or neither, to skip the reload check.
 *
 * `absent` is for the delete and revert paths, and it is the harder assertion
 * to get right: "not on the page" is also true when the page failed to load,
 * rendered empty, or bounced. Every `absent` scenario therefore creates the
 * row first, in the same run, so the reload has to show a page that *would*
 * have contained it.
 */
const SCENARIOS = [
  {
    name: 'rank-tracker: add a keyword',
    route: '/rank-tracker',
    // The flow behind the SEO tooling. Nothing in Rank Tracker displays until
    // a tracked_keywords row exists, and connecting Google Marketing creates
    // none — this form is the only thing that makes one.
    async run(page, t) {
      const kw = `${stamp()} pizza`
      await t.click('Single')
      await t.fill('Company name', 'Acme Industrial')
      await t.fill('https://site.com', 'https://acme.test')
      await t.fill('best pizza brooklyn', kw)
      await t.submit('Add Keyword')
      return kw
    },
    persists: kw => kw,
  },

  {
    name: 'crm/contacts: add a contact',
    route: '/crm/contacts',
    async run(page, t) {
      const last = `${stamp()}`
      await t.click('New Contact')
      await t.fill('First name', 'Harness')
      await t.fill('Last name', last)
      // Stamped, not fixed: the POST rejects a duplicate email with a 409, so
      // a constant address passes once and then fails every run after it.
      await t.fill('Email address', `${last}@example.invalid`)
      await t.pickCompany('Acme Industrial')
      await t.submit('Create Contact')
      return last
    },
    persists: last => last,
  },

  {
    name: 'tasks: add a task',
    route: '/tasks',
    async run(page, t) {
      const title = `${stamp()} task`
      await t.click('New Task')
      await t.fill('e.g. Follow up on Apex proposal', title)
      // Due date is required (`canSave = title.trim() && dueDate`) and the
      // input has no placeholder to find it by.
      await t.step('set the due date', () =>
        page.locator('input[type="date"]').first().fill('2026-12-31'))
      await t.submit('Create Task')
      return title
    },
    persists: title => title,
  },

  {
    name: 'crm/companies: add a company',
    route: '/crm/companies',
    async run(page, t) {
      const name = `${stamp()} Holdings`
      await t.click('New Company')
      await t.fill('e.g. Coastal Realty Group', name)
      // Industry is required (`canSave = form.name.trim() && form.industry`)
      // and is a plain <select> with no label association, so it is found by
      // its own placeholder option rather than by a `for`/`id` pair.
      await t.step('choose an industry', () =>
        page.locator('select').filter({ hasText: 'Select industry...' }).first()
          .selectOption('Construction'))
      await t.submit('Create Company')
      return name
    },
    persists: name => name,
  },

  {
    name: 'tickets: open a ticket',
    route: '/tickets',
    async run(page, t) {
      const subject = `${stamp()} cannot log in`
      await t.click('New Ticket')
      await t.fill('Brief description of the issue...', subject)
      await t.pickCompany('Acme Industrial')
      await t.fill('Full name', 'Maya Chen')
      await t.fill('Describe the issue in detail...', 'Raised by the interaction harness.')
      await t.submit('Open Ticket')
      return subject
    },
    persists: subject => subject,
  },

  {
    name: 'time-tracking: log an entry',
    route: '/time-tracking',
    async run(page, t) {
      const note = `${stamp()} billable work`
      await t.click('Log Time')
      await t.fill('What did you work on?', note)
      // Save is disabled until the duration is non-zero. Hours and minutes are
      // two inputs that share the placeholder "0"; hours is the first.
      await t.step('set the duration', () =>
        page.getByPlaceholder('0', { exact: true }).first().fill('2'))
      await t.submit('Save Entry')
      return note
    },
    persists: note => note,
  },

  {
    name: 'tasks: delete a task',
    route: '/tasks',
    // The delete path, not the create path. Every list here removes the row
    // optimistically and only then sends the DELETE — so a DELETE that fails
    // leaves a screen that says the row is gone and a database that disagrees,
    // until the next reload. AUDIT #294 and #121 were both this shape, and a
    // create-only scenario would never touch it.
    async run(page, t) {
      const title = `${stamp()} doomed`
      await t.click('New Task')
      await t.fill('e.g. Follow up on Apex proposal', title)
      await t.step('set the due date', () =>
        page.locator('input[type="date"]').first().fill('2026-12-31'))
      await t.submit('Create Task')
      await page.waitForTimeout(1500)

      // Reload first, so the row being deleted is one the server served —
      // not the optimistic copy the create just put in React state.
      await t.reload('/tasks', title)
      await t.step('open the task', () => page.getByText(title, { exact: false }).first().click())
      // `confirm('Delete this task?')` — the dialog handler in browser.mjs
      // accepts it; without one this click would simply never return.
      await t.step('delete it', () =>
        page.getByTitle('Delete task').first().click({ timeout: ACT_TIMEOUT }))
      return title
    },
    absent: title => title,
  },

  {
    name: 'time-tracking: edit an entry',
    route: '/time-tracking',
    // The update path. A PATCH that drops the edited field, or a form that
    // posts the original values back, both look identical on screen until the
    // page is reloaded.
    async run(page, t) {
      const note = `${stamp()} draft`
      await t.click('Log Time')
      await t.fill('What did you work on?', note)
      await t.step('set the duration', () =>
        page.getByPlaceholder('0', { exact: true }).first().fill('1'))
      await t.submit('Save Entry')
      await page.waitForTimeout(1500)

      await t.reload('/time-tracking', note)
      const edited = `${note} EDITED`
      // Scoped to the row that holds this note — the Edit control is a
      // hover-revealed icon repeated on every row, so an unscoped match would
      // edit whichever entry happened to be first.
      await t.step('open the entry for editing', () =>
        page.locator('div.group').filter({ hasText: note }).first()
          .getByTitle('Edit').click({ timeout: ACT_TIMEOUT }))
      await t.fill('What did you work on?', edited)
      await t.submit('Update Entry')
      return edited
    },
    persists: edited => edited,
  },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const { browser, page } = await openSession()
const chosen = SCENARIOS.filter(s => !ONLY || s.name.includes(ONLY))
let failed = 0

/**
 * Why a click on a visible button can still time out.
 *
 * Playwright waits for the element to actually receive the pointer, so a
 * button covered by something else fails with a bare "Timeout 30000ms
 * exceeded" that says nothing about what covered it. Naming the element on
 * top turns a half-hour of guessing into one line — this is how #785 was
 * identified, after the first version of this file reported only the timeout.
 */
async function whatIsOnTopOf(page, locator) {
  const box = await locator.boundingBox().catch(() => null)
  if (!box) return null
  return page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const cls = typeof el.className === 'string' ? el.className : ''
    return `<${el.tagName.toLowerCase()} class="${cls}">`.slice(0, 160)
  }, [box.x + box.width / 2, box.y + box.height / 2]).catch(() => null)
}

const writes = watchWrites(page)
const budget = watchRateLimit(page)

for (const scenario of chosen) {
  const watch = watchErrors(page)
  const done = []
  let where = 'navigate'
  let outcome = null
  let value

  const t = {
    async step(label, fn) {
      where = label
      await fn()
      done.push(label)
      // Every step here is followed by React work — a modal opening, a
      // controlled input committing, a fetch resolving. Without a beat the
      // next step races the render it depends on and fails as "element not
      // found", which reads exactly like the app being broken.
      await page.waitForTimeout(250)
    },

    click: (name, exact = true) => t.step(`click "${name}"`, async () => {
      const btn = page.getByRole('button', { name, exact }).first()
      try {
        await btn.click({ timeout: ACT_TIMEOUT })
      } catch (err) {
        const top = await whatIsOnTopOf(page, btn)
        throw new Error(top ? `"${name}" is covered by ${top}` : err.message)
      }
    }),

    fill: (placeholder, value) => t.step(`fill "${placeholder}"`, () =>
      page.getByPlaceholder(placeholder, { exact: true }).first().fill(value, { timeout: ACT_TIMEOUT })),

    /**
     * The company field is a searchable dropdown, not an input. Each option's
     * accessible name is the avatar letter, the company, and its industry run
     * together — "A Acme Industrial Manufacturing" — so this matches loosely
     * rather than on the name alone.
     */
    pickCompany: name => t.step(`pick company "${name}"`, async () => {
      await page.getByRole('button', { name: 'Select a company...' }).first().click({ timeout: ACT_TIMEOUT })
      await page.waitForTimeout(600)
      const option = page.getByRole('button', { name: new RegExp(name) }).first()
      if (!await option.count()) {
        // The dropdown loads its options from /api/crm/companies. When that
        // call is rate-limited the list is simply empty, and the bare click
        // timeout that follows says nothing about why. Name the cause.
        const search = await page.getByPlaceholder('Search companies...').count()
        throw new Error(search
          ? `the company dropdown is open but has no "${name}" — /api/crm/companies returned nothing (a 429?)`
          : `the company dropdown did not open`)
      }
      await option.click({ timeout: ACT_TIMEOUT })
    }),

    /**
     * Navigate to `route` afresh, retrying while the app is rate-limiting us.
     *
     * Each scenario costs two full page loads, and the app rate-limits its own
     * API routes per IP. A 429 almost never looks like a 429 from inside: the
     * list simply renders empty, which is the same thing the harness is here to
     * detect. Retrying on a miss is what tells the two apart — a row that is
     * really missing is still missing after the limiter resets.
     */
    reload: (route, mustContain = null, tries = 3) => t.step(`reload ${route}`, async () => {
      for (let i = 0; i < tries; i++) {
        await budget.throttle()
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForTimeout(2500)
        if (!mustContain) return
        const body = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ')
        if (body.includes(mustContain)) return
        if (i < tries - 1) await page.waitForTimeout(4000 * (i + 1))
      }
      throw new Error(`"${mustContain}" never appeared on ${route} across ${tries} loads`)
    }),

    /**
     * A submit that says *why* it could not submit.
     *
     * A disabled button and a covered button both surface as a click timeout,
     * and neither message mentions the form. Both are worth telling apart:
     * disabled means the scenario left a required field empty, covered means
     * a real user is blocked too.
     */
    submit: name => t.step(`submit "${name}"`, async () => {
      const btn = page.getByRole('button', { name, exact: true }).first()
      await btn.waitFor({ state: 'visible', timeout: ACT_TIMEOUT })
      if (await btn.isDisabled()) {
        throw new Error(`"${name}" is disabled — the form does not consider itself complete`)
      }
      try {
        await btn.click({ timeout: ACT_TIMEOUT })
      } catch (err) {
        const top = await whatIsOnTopOf(page, btn)
        throw new Error(top ? `"${name}" is covered by ${top}` : err.message)
      }
    }),
  }

  try {
    const paused = await budget.throttle()
    if (paused) console.log(`      (paused ${Math.round(paused / 1000)}s to stay under the app's 200/min rate limit)`)
    await page.goto(BASE + scenario.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2500)
    if (new URL(page.url()).pathname === '/login') throw new Error('bounced to /login')

    value = await scenario.run(page, t)
    // Wait for the app to finish writing rather than guessing at a duration.
    // Navigating with a request in flight cancels it, and a cancelled DELETE
    // is indistinguishable from a delete that does not persist.
    if (!await writes.idle()) console.log('      (a write was still in flight after 8s)')

    const expected = scenario.persists?.(value)
    const forbidden = scenario.absent?.(value)
    if (expected == null && forbidden == null) {
      outcome = { ok: true, note: 'no reload check' }
    } else {
      where = 'reload and look for the change'
      // A fresh navigation, deliberately: see the header. Optimistic UI makes
      // the pre-reload screen say yes regardless. Retried for `persists` so a
      // rate-limited load is not read as a lost write; not retried for
      // `absent`, where a retry could only turn a pass into a pass.
      for (let i = 0; i < (expected != null ? 3 : 1); i++) {
        await budget.throttle()
        await page.goto(BASE + scenario.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForTimeout(3000)
        const seen = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ')
        if (expected == null || seen.includes(expected) || i === 2) break
        await page.waitForTimeout(4000 * (i + 1))
      }
      const body = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ')
      if (expected != null) {
        outcome = body.includes(expected)
          ? { ok: true, note: `persisted: ${expected}` }
          : { ok: false, note: `gone after reload: ${expected}` }
      } else {
        // Guard against the empty-page reading of "absent": if the page came
        // back with nothing on it, absence proves nothing.
        outcome = body.length < 40
          ? { ok: false, note: `page came back empty (${body.length} chars), so "absent" means nothing` }
          : !body.includes(forbidden)
            ? { ok: true, note: `stayed deleted: ${forbidden}` }
            : { ok: false, note: `still there after reload: ${forbidden}` }
      }
    }
  } catch (err) {
    outcome = { ok: false, note: err.message.split('\n')[0].slice(0, 200) }
  }

  watch.stop()
  const errs = watch.real()
  const ok = outcome.ok && errs.length === 0
  if (!ok) failed++

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${scenario.name}`)
  // Only when the scenario itself broke. A scenario that completed but logged
  // an error did not "die" anywhere, and saying it did sends the reader to the
  // wrong place — the errors below are the finding.
  if (!outcome.ok) {
    console.log(`      died at: ${where}`)
    console.log(`      steps that passed: ${done.join(' -> ') || '(none)'}`)
  }
  if (outcome.note) console.log(`      ${outcome.note}`)
  for (const e of errs.slice(0, 8)) console.log(`      ${e}`)
  if (watch.throttled()) console.log('      (saw a 429 — this run rate-limiting the app, raise HARNESS_DELAY)')

  if (DELAY) await page.waitForTimeout(DELAY)
}

writes.stop()
budget.stop()
console.log(`\nfailing scenarios: ${failed}/${chosen.length}`)
await browser.close()
process.exit(failed ? 1 : 0)
