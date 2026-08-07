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
| `mint-session.mjs` | Signs a `gravhub-auth` cookie with the same HMAC scheme as `lib/session-cookie.ts`. |
| `drive.mjs` | Drives pages in Chromium and reports where each landed, whether seeded data rendered, and any console/page errors. |

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

Two things this cannot tell you: whether a number is *correct* (only that one
rendered), and whether a page works against real Postgres — `fake-supabase`
is not a database, and anything it doesn't model it reports on stderr at
shutdown rather than answering with `[]`.
