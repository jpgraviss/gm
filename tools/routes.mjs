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
