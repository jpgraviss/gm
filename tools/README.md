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

## Status: server-side works, browser-side does not yet

**Working, and verified.** The API layer authenticates and returns seeded
data:

```
$ curl -H "Cookie: gravhub-auth=$COOKIE" localhost:3000/api/crm/contacts
[{"id":"ct-1","fullName":"Maya Chen","companyName":"Acme Industrial",...}]

$ curl localhost:3000/api/crm/contacts        # no cookie
401
```

That alone makes this useful for exercising route handlers end to end against
a persistent store, which the mocked unit tests cannot do.

**Not working.** Driving authenticated *pages* in the browser still redirects
to `/login`. What is established so far:

- The `gravhub-auth` cookie is correct — the same value authenticates the API.
- `contexts/AuthContext.tsx` resolves the signed-in user from
  `supabase.auth.getUser()`, not from that cookie, so the client needs its own
  Supabase session.
- `fake-supabase.mjs` serves `/auth/v1/user`, and `drive.mjs` seeds
  `localStorage['sb-127-auth-token']`. Both were confirmed present — the seed
  lands and is the only `sb-` key.
- CORS was one real cause and is fixed: supabase-js sends `apikey` and
  `authorization`, both non-simple, so every call is preflighted, and the
  missing `Access-Control-Allow-Headers` surfaced as `ERR_CONNECTION_RESET`
  rather than anything CORS-shaped.
- After that fix the redirect persists, so `AuthContext` is rejecting the user
  somewhere past `getUser()`. That is where the next session should pick up —
  instrument `AuthContext`'s bootstrap and find which branch nulls the user.

Do not treat a green `drive.mjs` run as meaningful until that is resolved; a
page that bounces to `/login` reports no errors and looks calm.
