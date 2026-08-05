#!/usr/bin/env node
/**
 * Migration filename convention check (run from CI — see .github/workflows/ci.yml).
 *
 * Every NEW file added to supabase/migrations/ must be named
 * `YYYYMMDDHHMMSS_description.sql` so the directory has a single, unambiguous,
 * lexicographically-sortable apply order. See supabase/migrations/README.md for
 * the full rationale.
 *
 * The 144 pre-existing files that don't follow the convention are grandfathered
 * in via scripts/legacy-migration-filenames.txt. They have already been applied
 * to production and renaming them would only invalidate the historical record —
 * so they are exempt, but the exemption is an explicit, reviewable checked-in
 * list rather than an open-ended pattern. Adding a name to that file to silence
 * this check is a deliberate act that shows up in review.
 *
 * Deliberately NOT git-diff based: `actions/checkout@v4` clones at depth 1, so
 * there is no merge-base to diff against without changing the checkout config,
 * and `push` builds on main have no natural base ref at all. Comparing against a
 * committed snapshot is deterministic, works identically locally and in CI, and
 * needs no git history.
 *
 * Usage: node scripts/check-migration-naming.mjs
 * Exit 0 = clean, exit 1 = a new migration is misnamed (or the legacy list drifted).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
const legacyListPath = path.join(__dirname, 'legacy-migration-filenames.txt')

// YYYYMMDDHHMMSS_description.sql
const TIMESTAMP_PREFIX = /^\d{14}_[a-z0-9]+(?:[_-][a-z0-9]+)*\.sql$/

function fail(lines) {
  for (const line of lines) console.error(line)
  process.exit(1)
}

if (!fs.existsSync(migrationsDir)) {
  fail([`::error::Migrations directory not found: ${migrationsDir}`])
}
if (!fs.existsSync(legacyListPath)) {
  fail([`::error::Legacy migration allowlist not found: ${legacyListPath}`])
}

const legacy = new Set(
  fs.readFileSync(legacyListPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#')),
)

// Only .sql files are migrations — README.md and any other supporting file in
// the directory are not subject to the convention.
const present = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

const offenders = present.filter(f => !legacy.has(f) && !TIMESTAMP_PREFIX.test(f))

// A legacy entry that no longer exists on disk means a historical migration was
// renamed or deleted. That's not necessarily wrong, but it silently shrinks the
// exemption list, so it has to be an explicit edit to the list too.
const missingLegacy = [...legacy].filter(f => !present.includes(f)).sort()

const errors = []

if (offenders.length > 0) {
  errors.push(
    `::error::${offenders.length} migration file(s) in supabase/migrations/ are missing the required YYYYMMDDHHMMSS_ prefix:`,
    ...offenders.map(f => `  - ${f}`),
    '',
    'New migrations must be named YYYYMMDDHHMMSS_description.sql (UTC timestamp), e.g.:',
    `  ${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}_add_widget_table.sql`,
    'See supabase/migrations/README.md.',
  )
}

if (missingLegacy.length > 0) {
  errors.push(
    `::error::${missingLegacy.length} file(s) listed in scripts/legacy-migration-filenames.txt no longer exist in supabase/migrations/:`,
    ...missingLegacy.map(f => `  - ${f}`),
    '',
    'If a historical migration was intentionally renamed or removed, update that list in the same commit.',
  )
}

if (errors.length > 0) fail(errors)

console.log(
  `Migration naming OK — ${present.length} .sql file(s): ` +
  `${legacy.size} grandfathered, ${present.length - legacy.size} timestamp-prefixed.`,
)
