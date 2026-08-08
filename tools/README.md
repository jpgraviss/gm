# Local harness — driving the app without a database

Every authenticated flow in GravHub is currently unverifiable. The unit suite
mocks `createServiceClient` per test, which proves a handler behaves given a
fake row but never proves the page renders it, that the numbers add up, or
that a flow completes. AUDIT #773 — signature and proposal links bouncing
external recipients to `/login`, breaking the two most business-critical
external flows in the product — survived ~770 source-level findings and was
obvious within a minute of opening the page in a browser.

This directory is an attempt to close that gap without needing production
credentials or network access to a deployed environment.

## What's here

| File | Purpose |
|---|---|
| `fake-supabase.mjs` | Speaks enough PostgREST for the app's client. Serves `fixtures.json`, persists writes in memory, and mirrors the real atomic-counter RPCs. |
| `fixtures.json` | Seed data. `jonathangraviss@gmail.com` is the admin team member. |
| `schema.mjs` | Reads every SQL file under `supabase/` so fixture rows get the NOT NULL defaults an `INSERT` would. See "Phantom findings" below. |
| `used-tables.mjs` | The tables the app actually queries, from its `.from('…')` call sites. A fixture table nothing reads is rejected at startup. |
| `mint-session.mjs` | Signs a `gravhub-auth` cookie with the same HMAC scheme as `lib/session-cookie.ts`. |
| `browser.mjs` | Opens an authenticated browser and decides what counts as a real error. Shared by the two drivers so they cannot drift apart. |
| `drive.mjs` | Crawls every route and reports where each landed, whether seeded data rendered, and any console/page errors. |
| `interact.mjs` | Performs real user actions — click, fill, submit — and checks the result survived a reload. |

## Running it

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=fake-anon-key
SUPABASE_SERVICE_ROLE_KEY=fake-service-key
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SESSION_SIGNING_KEY=local-harness-signing-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

node tools/fake-supabase.mjs 54321 &
npm run dev &

HARNESS_COOKIE=$(SESSION_SIGNING_KEY=local-harness-signing-key node tools/mint-session.mjs) \
  node tools/drive.mjs

# ...and the interaction scenarios, which actually change things:
HARNESS_COOKIE=$(SESSION_SIGNING_KEY=local-harness-signing-key node tools/mint-session.mjs) \
  node tools/interact.mjs
```

`.env.local` is gitignored. Nothing here touches a real database, and no
email is ever sent — the seeded address is only an identity.

## Status: working, both server-side and in the browser

The API layer authenticates and returns seeded data:

```
$ curl -H "Cookie: gravhub-auth=$COOKIE" localhost:3000/api/crm/contacts
[{"id":"ct-1","fullName":"Maya Chen","companyName":"Acme Industrial",...}]

$ curl localhost:3000/api/crm/contacts        # no cookie
401
```

And authenticated *pages* now render: all 15 routes in `drive.mjs` land on
themselves with seeded data on screen, none bounce to `/login`.

Getting there took three fixes, each of which had exactly the same misleading
symptom — `ERR_CONNECTION_RESET`, or nothing at all:

1. **CORS.** supabase-js sends `apikey` and `authorization`, both non-simple,
   so every call is preflighted. The missing `Access-Control-Allow-Headers`
   killed the preflight, which the browser reports as a connection reset
   rather than anything CORS-shaped.
2. **CSP (AUDIT #774).** `next.config.ts` hardcoded
   `connect-src … https://*.supabase.co`, so the browser refused to open any
   connection to `http://127.0.0.1:54321` — zero requests left the tab. The
   origin is now derived from `NEXT_PUBLIC_SUPABASE_URL`. This was a real
   production bug too: any deployment on self-hosted Supabase or a custom
   domain was silently blocked the same way.
3. **The auth-lock deadlock (AUDIT #775).** `contexts/AuthContext.tsx` awaited
   a Supabase read inside its `onAuthStateChange` callback. supabase-js runs
   those callbacks while holding its auth lock, so the read waited on a lock
   held by the thing waiting on the read. Nothing threw; the promise just
   never settled. This one was **not** a harness artifact — it broke password
   sign-in in production, and it is the reason the app kept bouncing to
   `/login`. Guarded by
   `tests/unit/lib/auth-state-change-callsite.test.ts`.

Only #1 was the harness's own fault. #2 and #3 were real defects the harness
existed to find, and found within an hour of first working — which is the
argument for keeping it.

## Reading a run

`drive.mjs` prints, per page: where it landed, whether seeded data rendered,
and console/page errors. A bounce to `/login` is always a failure; so is a
page that loads with `data:no` when it should have data. Note that a bouncing
page reports zero errors and looks calm, so read the landed column first.

Two things this cannot tell you: whether a page works against real Postgres —
`fake-supabase` is not a database, and anything it doesn't model it reports on
stderr at shutdown rather than answering with `[]` — and whether a number is
*right*, unless you check it against the fixtures yourself. It is worth doing:
the first substantive find (AUDIT #776, every non-Stripe payment counting as
$0 of revenue) came from noticing that Billing said `REVENUE COLLECTED $0`
directly above a tab labelled `Paid (1)`.

## Clicking things: `interact.mjs`

The crawl proves 78 routes render. It never touches anything, so every write
path in the app stayed unverified end to end — a form that posts nothing, a
route that 500s on save, a field the API drops. All three look identical to a
crawl, because the page they live on renders perfectly.

Each scenario opens a page, performs the action, and then **navigates to the
page afresh** and looks for what it created. The reload is the whole point:
almost every list here updates optimistically (`setRows(prev => [created,
...prev])`), so the post-click screen shows the new row whether or not anything
was persisted. AUDIT #294 was an entire family of exactly that.

Two things it does deliberately that look like oversights:

- **It leaves the cookie banner undismissed.** Seeding consent would make every
  scenario simpler, and would have hidden AUDIT #785 — the banner was `z-[9999]`
  and covered the submit button of the first modal this file ever opened. A
  first-time visitor is the harder case, so that is the case it runs.
- **It stamps a random token into every value it types.** The contacts POST
  rejects a duplicate email with a 409, so a fixed address passes once and fails
  every run after it. Anything a scenario searches for after a reload has to be
  a string nothing else could produce.

When a click times out, the runner reports what `elementFromPoint` finds at the
button's centre instead of the bare Playwright timeout. That one line is the
difference between "Timeout 30000ms exceeded" and "covered by `<div
class="fixed bottom-0 …">`", and it is how #785 was identified.

### Deletes and edits, and why they needed two more pieces

Create-only scenarios never touch the paths that historically broke. AUDIT #294
and #121 were both *delete* bugs: the row disappears from the screen
optimistically and the DELETE that follows fails, so the UI and the database
disagree until the next reload. `absent:` scenarios cover that — but they only
mean something if the page they check would have shown the row, so each one
creates it first, reloads, and only then deletes. A run that finds the page
empty reports that instead of passing.

Getting those to pass truthfully needed two things that are easy to get wrong:

- **Waiting for the app to finish writing.** Nothing here awaits its own
  mutation; handlers fire `fetch(...)` and update React state. Navigating on a
  timer cancels whatever is still in flight, and a cancelled DELETE looks
  exactly like a DELETE that didn't persist. `watchWrites()` tracks outstanding
  POST/PATCH/PUT/DELETE and the runner waits for them to settle.
- **Staying under the app's own rate limit.** `proxy.ts` allows 200 API
  requests per minute per IP; one page load costs ten to twenty, and a scenario
  costs three page loads. Over the line, the limiter answers 429, the page's
  fetch resolves to nothing, and the list renders empty — again indistinguishable
  from a lost write. Backing off *after* a 429 doesn't help, because the window
  is 60s and the limiter keeps refusing for the rest of it. `watchRateLimit()`
  counts what the harness sends and pauses before the next burst.

  The pause is timed off the *last* request that has to expire, not the first.
  Waiting for the oldest frees exactly one slot, so a run over budget by fifty
  would wait a full minute and still be over — the first version of this stalled
  a run indefinitely while looking like it was working.

A full run therefore takes a few minutes and will print lines like
`(paused 47s to stay under the app's 200/min rate limit)`. That is the harness
being correct, not slow.

## Phantom findings, and why `schema.mjs` exists

The very first two "findings" this harness produced were both fake. An
Automations page crash on `statusConfig[auto.status].dot`, and a Contracts
page crash on `c.assignedRep.split(' ')` — both columns are
`not null default …` in `supabase/schema.sql`, so neither value can be absent
in a real database. `fixtures.json` had simply omitted them.

That is the harness manufacturing bugs the app cannot have: the same false
confidence it was built to remove, inverted, and more expensive, because a
phantom is indistinguishable from a real find until you have chased it.

So fixture rows are now treated the way Postgres treats an `INSERT`: an
omitted NOT NULL column takes its schema default, and a NOT NULL column with
*no* default is a hard error that refuses to start the fake rather than an
`undefined` that resurfaces later as somebody else's stack trace. The same
rule applies to rows the app creates mid-run.

The practical rule when this harness reports a crash: **check the schema
before believing it.** If the field is NOT NULL, the fixture is wrong, not the
app.

That protection then turned out to be half-built twice over, and both gaps are
worth knowing about because they are the shape this whole file warns against —
a check that looks thorough and quietly covers less than you think.

- **It read only `schema.sql`,** which defines 28 tables. The app queries 93,
  the rest declared across `supabase/migrations/` and `schema_calendar.sql`.
  So the defaults were silently skipped for two thirds of the schema. It now
  reads every SQL file, handles `alter table … add column` and `drop column`,
  and knows 99 tables.
- **A fixture table nothing queries was invisible.** Four had accumulated —
  `tasks`, `notifications`, `maintenance`, `pipelines` — every one a guess at
  a name the app does not use (it reads `app_tasks`, `portal_notifications`,
  `maintenance_records`, and keeps pipeline config in `app_settings.pipelines`
  rather than a table). Nothing complained: the fake served those rows to
  nobody, the pages rendered empty, and the crawl reported `data:no`, which
  reads exactly like "this page fails to show its data". `/tasks` and
  `/crm/pipeline` both sat in that state, and the pipeline one cost real time
  to chase. `used-tables.mjs` now refuses to start on a table no `.from('…')`
  call site names.

Both were found by taking the parser's own accusations seriously: when it
started reporting NOT NULL columns the fixtures "omitted", three of the five
turned out to be the parser misreading multi-column `ALTER` statements — it
let a later column's `not null` and `default` clauses bleed into the first
one's definition. Only `broadcasts.subject` was a genuine gap. Worth
repeating: **when this tooling accuses the fixtures, verify the accusation
before acting on it**, exactly as you would when it accuses the app.

- **Nullable columns were omitted rather than served as `null`.** A real
  `INSERT` followed by `select('*')` returns every column, with unspecified
  nullable ones as `null`. This fake returned only the keys the fixture
  happened to list, so those columns came back `undefined` instead. That is
  not a harmless difference: the app is full of `x === null` guards, and a
  strict comparison against `undefined` is false, so every one of them
  silently failed to fire. `/audits/[id]` rendered `undefined/100 Overall
  Score` because of it, and its `overall_score === null ? 'Unavailable' : …`
  guard had been correct the whole time. Fixture rows are now filled to the
  full column set.

That is the fourth phantom this fake produced, and all four shared one cause:
**it was not shaped like PostgREST.** Missing `PGRST116` codes, missing NOT
NULL defaults, invented table names, absent nullable keys. When a page here
looks broken, the first question is whether a real Postgres would have sent
the same bytes.

- **An unimplemented filter operator was ignored rather than refused.** The
  fifth phantom, and the worst of them, because it made the fake *more
  permissive* than PostgREST instead of less. `applyFilters` parsed
  `col=op.value` against a fixed list of operators and did `if (!m) continue`
  on anything else — so a filter it did not understand simply did not narrow
  the result set. Four of the app's operators landed in that branch: `cs`
  (`.contains`, 13 call sites), `ov` (`.overlaps`, 4), `not` (33), and the
  top-level `or=` (20). Every crawl to date read those pages through filters
  that were not applied.

  The bill came due on `POST /api/crm/contacts`, whose duplicate check is
  `.overlaps('emails', emails).limit(1).maybeSingle()`. With `ov` ignored that
  matched the first contact in the table, so creating *any* contact with *any*
  email returned 409 "A contact with this email already exists: Maya Chen".
  A real bug and a fake that invents one are indistinguishable from outside.

  All four are now implemented, and — the part that matters more — an operator
  the fake does not know is a **501 with the offending filter in the body**,
  recorded in the unmodelled list at shutdown. Refusing to answer is the only
  safe response; the alternative is rows a real PostgREST would never have sent.

The same trap has a protocol-shaped version. A crawl reported
`GET /api/calendar/settings` as a 500 for a user with no calendar configured.
The route was right — it branches on `error?.code === 'PGRST116'` to return
`null` — but this fake's 406 body carried only a `message`, no `code`, so the
guard missed. Routes branch on PostgREST's error *codes*, not its prose, so
the fake has to send them. Fixed, and worth remembering: when the harness
accuses a route, check what the real service would have sent.

Two more things that are the crawl's own doing rather than findings, both
already labelled in the output:

- **429s.** The app rate-limits its own API routes, and ~70 pages back to back
  trips it. Raise `HARNESS_DELAY` before believing a 429.
- **Editing source mid-crawl.** `next dev` recompiles under the running
  browser, so an edit made during a crawl shows up as a compile error on
  whichever page was unlucky. Let the crawl finish first.
- **Running anything else heavy mid-crawl.** The crawl gives each page a fixed
  3s to settle. Start the test suite alongside it and the slower pages navigate
  away with requests still in flight, which lands as a cluster of
  `neterr net::ERR_ABORTED` across half a dozen endpoints at once. That shape —
  many endpoints, all aborted, one page — is the tell. `/reports/attribution`
  reported `chars=11 errs=12` this way and `chars=761 errs=0` when re-run alone.
