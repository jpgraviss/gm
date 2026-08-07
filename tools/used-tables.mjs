/**
 * The tables the app actually queries, derived from its `.from('…')` call
 * sites.
 *
 * This exists because a fixture table nothing reads is invisible. Four of them
 * had accumulated — `tasks`, `notifications`, `maintenance` and `pipelines` —
 * and every one was a guess at a name the app does not use: it reads
 * `app_tasks`, `portal_notifications`, `maintenance_records`, and keeps
 * pipeline config in `app_settings.pipelines` rather than a table at all.
 *
 * Nothing complained. The fake served the seeded rows to nobody, the pages
 * rendered empty, and the crawl reported `data:no` — which reads exactly like
 * "this page fails to show its data", the finding the harness exists to
 * surface. `/tasks` and `/crm/pipeline` both sat in that state, and the
 * pipeline one cost real time to chase before the cause turned out to be the
 * fixture rather than the app.
 *
 * So the rule is now enforced: every fixture table must be one the app
 * queries. A regex over call sites is enough — Supabase table access always
 * goes through `.from('name')` with a literal, and any dynamic access this
 * misses would show up as an unmodelled-table report from the fake instead.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const SCAN = ['app', 'lib', 'components', 'contexts']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** @returns {Set<string>} table names appearing in a `.from('…')` call. */
export function usedTables() {
  const found = new Set()
  for (const dir of SCAN) {
    const full = join(ROOT, dir)
    if (!existsSync(full)) continue
    for (const file of walk(full)) {
      const src = readFileSync(file, 'utf-8')
      for (const m of src.matchAll(/\.from\('([a-z_0-9]+)'\)/g)) found.add(m[1])
    }
  }
  return found
}
