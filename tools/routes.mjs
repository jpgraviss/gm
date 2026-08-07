/**
 * The app's authenticated, parameterless page routes, derived from the
 * filesystem.
 *
 * Derived rather than listed, for the reason AUDIT #764 records: a
 * hand-maintained route list looks complete right up until someone adds a
 * page, and the gap is invisible because the list still names plausible
 * neighbours. A crawler working from a stale list reports "all green" over
 * routes it never visited.
 *
 * Dynamic segments (`[id]`) are excluded because they need a real id from the
 * fixtures; drive them explicitly via HARNESS_PAGES when you want them.
 */
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const APP = join(here, '..', 'app')

/**
 * Routes that are deliberately not part of a signed-in crawl.
 *
 * `lib/public-routes.ts` is the app's own list and is the authority on what
 * an anonymous visitor may reach; this is a different question — which pages
 * are uninteresting or actively disruptive to visit *as staff*. Sign-out and
 * setup flows would end the session the rest of the crawl depends on.
 */
const SKIP = [
  '/login', '/team-login', '/setup-account', '/auth/confirm',
  '/portal/setup', '/portal/auth/verify',
  // Marketing and demo pages render fixed copy, not account data — a crawl
  // over them proves nothing and dilutes the failure count.
  '/what-we-do', '/demo',
]

function walk(dir, prefix = '', out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry.startsWith('_')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // Route groups `(name)` don't appear in the URL.
      const seg = /^\(.*\)$/.test(entry) ? prefix : `${prefix}/${entry}`
      walk(full, seg, out)
    } else if (entry === 'page.tsx') {
      out.push(prefix === '' ? '/' : prefix)
    }
  }
  return out
}

export function staticRoutes() {
  return walk(APP)
    .filter(r => !r.includes('['))
    .filter(r => !SKIP.some(s => r === s || r.startsWith(s + '/')))
    .sort()
}

/**
 * Which fixture table supplies the id for each dynamic route, and which
 * column to read.
 *
 * Detail pages were the largest untested surface left: the crawl covered 71
 * parameterless routes and none of the `[id]` ones, which is where record
 * rendering, tab state and per-entity permissions actually live.
 *
 * Kept as an explicit map because the link between a URL segment and a table
 * is a judgement call — `/audits/[id]` reads `audits`, `/sign/[token]` reads a
 * *token column* rather than an id — and guessing it wrongly produces exactly
 * the phantom findings this harness has already generated three times. Any
 * route missing from here is reported by `dynamicRoutes()` rather than
 * silently skipped, so the gap stays visible.
 */
const DYNAMIC = {
  '/audits/[id]':                    { table: 'audits', column: 'id' },
  '/chatbots/[id]/conversations':    { table: 'chatbots', column: 'id' },
  '/courses/[id]':                   { table: 'courses', column: 'id' },
  '/client/courses/[id]':            { table: 'courses', column: 'id' },
  '/crm/sequences/[id]':             { table: 'sequences', column: 'id' },
  '/projects/[id]':                  { table: 'projects', column: 'id' },
  '/sign/[token]':                   { table: 'signature_requests', column: 'token' },
  // Public marketing/booking slugs and the client-facing service pages take
  // their segment from config rather than a table row, so they are driven
  // explicitly via HARNESS_PAGES when wanted rather than guessed at here.
}

/**
 * Concrete URLs for the app's dynamic routes, built from fixture rows.
 *
 * @returns {{routes: string[], unmapped: string[], empty: string[]}}
 *   `unmapped` names dynamic routes with no entry in DYNAMIC; `empty` names
 *   mapped ones whose fixture table has no rows. Both are coverage gaps and
 *   are reported rather than hidden.
 */
export function dynamicRoutes(fixtures) {
  const all = walk(APP).filter(r => r.includes('['))
    .filter(r => !SKIP.some(s => r === s || r.startsWith(s + '/')))
  const routes = []
  const unmapped = []
  const empty = []
  for (const route of all.sort()) {
    const spec = DYNAMIC[route]
    if (!spec) { unmapped.push(route); continue }
    const rows = fixtures[spec.table] ?? []
    const value = rows[0]?.[spec.column]
    if (value === undefined || value === null) { empty.push(`${route} (${spec.table}.${spec.column})`); continue }
    routes.push(route.replace(/\[[^\]]+\]/, String(value)))
  }
  return { routes, unmapped, empty }
}
