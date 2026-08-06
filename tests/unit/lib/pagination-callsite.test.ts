import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * A total computed over one page of a paginated list is a wrong number.
 *
 * This class has been found and fixed FIVE times: #103 (dashboard KPIs at
 * 100 rows), #109 (sales training), #206 (Reports module), #743 (Admin MRR)
 * and #754 (Admin pipeline value and open-project count — in the same
 * `useEffect` #743 had already edited). Every occurrence is silent: the page
 * renders a plausible smaller number, nothing errors, and the only way to
 * notice is to know the real figure independently.
 *
 * Five repeats means the pattern needs a guard rather than a sixth sweep.
 *
 * The rule: if a component fetches a **cursor-paginated** endpoint and feeds
 * the result to an aggregate (`.reduce`, a filtered `.length`), it must use
 * `fetchAllPages`, which follows `X-Next-Cursor` to completion. Fetching one
 * page is fine for a display list — the user scrolls, and pagination is the
 * point.
 */

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** Endpoints whose GET is cursor-paginated — derived, never hardcoded. */
function paginatedEndpoints(): Set<string> {
  return new Set(
    walk(join(root, 'app/api'))
      .filter(f => f.endsWith('route.ts') && /paginatedJson/.test(readFileSync(f, 'utf-8')))
      .map(f => f.replace(join(root, 'app/api') + '/', '').replace(/\/route\.ts$/, '')),
  )
}

/**
 * Call sites verified by reading them, where one page is genuinely enough.
 *
 * An explicit list rather than a cleverer heuristic, for the same reason as
 * `tests/unit/lib/email-normalize.test.ts`: anything not listed is a
 * violation by default, so adding an entry is a deliberate act that says "I
 * read this and the bound is real".
 */
const VERIFIED_BOUNDED = new Map<string, string>([
  // Scoped to one week AND explicitly capped at 500. A single contractor
  // logging 500 time entries in one week is not a real scenario.
  ['app/page.tsx:/api/time-entries', 'week-scoped with an explicit limit=500'],
  // Counts `steps` inside ONE workflow object, not across the fetched array
  // — the aggregate has nothing to do with how many workflows came back.
  ['app/client/workflow/page.tsx:/api/delivery/workflow', 'counts steps within a single workflow'],
])

interface Hit { file: string; endpoint: string; line: number }

function aggregateFetches(): Hit[] {
  const paginated = paginatedEndpoints()
  const hits: Hit[] = []

  for (const full of [...walk(join(root, 'app')), ...walk(join(root, 'components'))]) {
    if (full.includes(join('app', 'api'))) continue
    const file = full.replace(root + '/', '')
    const lines = readFileSync(full, 'utf-8').split('\n')

    lines.forEach((line, i) => {
      const m = line.match(/fetch\(['"`]\/api\/([^'"`?]+)/)
      if (!m) return
      const endpoint = m[1].replace(/\/$/, '')
      if (!paginated.has(endpoint)) return
      // A write isn't a list read.
      if (/method:\s*['"](POST|PATCH|PUT|DELETE)/.test(lines.slice(i, i + 4).join(' '))) return
      // Does the response feed a total rather than a rendered list?
      const after = lines.slice(i, i + 14).join(' ')
      if (!/\.reduce\(|\.filter\([^)]*\)\.length|\.length\b(?!\s*[,)])/.test(after)) return
      hits.push({ file, endpoint: `/api/${endpoint}`, line: i + 1 })
    })
  }
  return hits
}

describe('aggregates over paginated endpoints', () => {
  it('derives a non-empty set of paginated endpoints', () => {
    // Without this, a rename of `paginatedJson` would empty the set and the
    // real check below would pass by having nothing to check.
    const eps = paginatedEndpoints()
    expect(eps.size).toBeGreaterThan(20)
    expect(eps.has('contracts')).toBe(true)
    expect(eps.has('deals')).toBe(true)
  })

  it('uses fetchAllPages wherever a total is computed', () => {
    const offenders = aggregateFetches()
      .filter(h => !VERIFIED_BOUNDED.has(`${h.file}:${h.endpoint}`))
      .map(h => `${h.file}:${h.line} — plain fetch('${h.endpoint}') feeds an aggregate; use fetchAllPages`)

    // Each entry is a figure that silently under-reports past one page.
    expect(offenders).toEqual([])
  })

  it('keeps the bounded-exception list honest', () => {
    // A listed exception that no longer matches means the call site changed
    // — the entry should be re-read rather than left as a standing waiver.
    const seen = new Set(aggregateFetches().map(h => `${h.file}:${h.endpoint}`))
    const stale = [...VERIFIED_BOUNDED.keys()].filter(k => !seen.has(k))
    expect(stale).toEqual([])
  })
})
