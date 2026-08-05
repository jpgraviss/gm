#!/usr/bin/env node
/**
 * Full-database JSON backup for GravHub.
 *
 * Run locally (NOT in CI, NOT from the app) with your own service-role key:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-database.mjs
 *
 * Reads .env.local automatically if present, so in a normal working copy this
 * is just:
 *
 *   node scripts/backup-database.mjs
 *
 * Writes ./backups/gravhub-backup-<UTC timestamp>.json containing every row of
 * every table PostgREST exposes on the live project.
 *
 * ── Design notes (please read before "simplifying" this) ────────────────────
 *
 * 1. NEVER WRITES A PARTIAL FILE THAT LOOKS COMPLETE. Everything is collected
 *    in memory, integrity-checked, then written to a temp file and atomically
 *    renamed. If ANY table fails, the output is named
 *    `...INCOMPLETE.json`, `manifest.complete` is false, and the process exits
 *    1. A file named `gravhub-backup-<ts>.json` is always a full dump.
 *
 * 2. PAGINATION IS THE WHOLE POINT. AUDIT.md #209 (and #48/#151/#206/#212/#273/
 *    #285/#698 — this repo has hit the same bug class 15+ times) was exactly
 *    this: a "full backup" that silently stopped at the first 100 rows. Every
 *    table here is read with explicit .range() paging, ordered by primary key
 *    so paging is stable, and then the row count is verified against a separate
 *    `count: 'exact'` query. A short read is a hard error, not a shrug.
 *
 * 3. THE TABLE LIST IS NOT HARDCODED. It's derived from supabase/schema.sql +
 *    supabase/migrations/*.sql, and then reconciled against the live database
 *    via PostgREST's OpenAPI description. The live list wins — schema.sql is a
 *    known-stale partial snapshot (~28 tables declared vs ~98 created across
 *    the migrations, and migrations exist that were never applied — see
 *    AUDIT.md #701). Tables that exist live but appear in neither repo file are
 *    still backed up, and reported.
 *
 * ── What this does NOT cover ───────────────────────────────────────────────
 *
 *   - Supabase Storage objects (buckets `client-files`, `proposal-pdfs`,
 *     `company-files`). Row metadata in `company_files` is backed up; the file
 *     bytes are not.
 *   - The `auth` schema (Supabase Auth users/identities/sessions). PostgREST
 *     does not expose it. Portal/staff login records live there.
 *   - Database objects: RLS policies, functions, triggers, indexes, enums,
 *     sequence positions, extensions.
 *
 * This is a data export, not a substitute for Point-in-Time Recovery.
 * See docs/DISASTER-RECOVERY.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

const PAGE_SIZE = 1000
// A table with more rows than this almost certainly means the paging loop is
// not terminating (a non-unique order column re-reading the same window, say).
// Better to fail loudly than to spin forever or OOM silently.
const MAX_PAGES_PER_TABLE = 10_000

const args = process.argv.slice(2)
const hasFlag = (f) => args.includes(f)
const flagValue = (f, fallback) => {
  const i = args.indexOf(f)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Usage: node scripts/backup-database.mjs [options]

  --out-dir <dir>   Output directory (default: ./backups)
  --skip-introspect Skip live schema introspection and use only the repo-derived
                    table list. The result is marked INCOMPLETE because it can
                    no longer be proven to cover every live table.
  --help            Show this message

Environment (read from the shell or from .env.local):
  NEXT_PUBLIC_SUPABASE_URL     (or SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY
`)
  process.exit(0)
}

// ── Environment ─────────────────────────────────────────────────────────────

/** Minimal .env.local reader — no dotenv dependency, shell env always wins. */
function loadEnvLocal() {
  const envPath = path.join(repoRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    if (process.env[key] !== undefined) continue
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  console.error('Set them in your shell or in .env.local (see .env.local.example).')
  console.error('The service-role key is required — the anon key cannot read past RLS.')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Table discovery ─────────────────────────────────────────────────────────

/**
 * Tables declared anywhere in the repo. schema.sql alone is not enough: it is a
 * partial snapshot that has drifted badly behind the migrations directory.
 */
function tablesFromRepo() {
  const sources = [path.join(repoRoot, 'supabase', 'schema.sql')]
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations')
  if (fs.existsSync(migrationsDir)) {
    for (const f of fs.readdirSync(migrationsDir).filter(n => n.endsWith('.sql')).sort()) {
      sources.push(path.join(migrationsDir, f))
    }
  }

  const found = new Set()
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi
  for (const file of sources) {
    if (!fs.existsSync(file)) continue
    const sql = fs.readFileSync(file, 'utf8')
    for (const m of sql.matchAll(re)) {
      // `create table storage.buckets`-style writes to other schemas aren't
      // ours to dump; the regex only accepts an optional `public.` prefix, but
      // a bare `storage.buckets` would match `buckets` — guard explicitly.
      const idx = m.index ?? 0
      const preceding = sql.slice(Math.max(0, idx), idx + m[0].length + 1)
      if (/\b(storage|auth|extensions|graphql)\./i.test(preceding)) continue
      found.add(m[1])
    }
  }
  return found
}

/**
 * Ask the live database what it actually exposes. PostgREST serves an OpenAPI
 * description at the REST root that lists every exposed table plus, per column,
 * whether it is part of the primary key. That gives us both the authoritative
 * table list and a stable ordering column for paging.
 */
async function introspectLive() {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/openapi+json' },
  })
  if (!res.ok) {
    throw new Error(`PostgREST introspection failed: HTTP ${res.status} ${res.statusText}`)
  }
  const spec = await res.json()
  const definitions = spec?.definitions ?? spec?.components?.schemas
  if (!definitions || typeof definitions !== 'object') {
    throw new Error('PostgREST introspection returned no table definitions')
  }

  const tables = new Map()
  for (const [name, def] of Object.entries(definitions)) {
    const props = def?.properties
    if (!props || typeof props !== 'object') continue
    const columns = Object.keys(props)
    const pk = columns.filter(c => /<pk\/>/.test(String(props[c]?.description ?? '')))
    tables.set(name, { columns, pk })
  }
  if (tables.size === 0) throw new Error('PostgREST introspection returned zero tables')
  return tables
}

/** Stable ordering columns for range paging — PK if known, else best guess. */
function orderColumns(meta) {
  if (meta?.pk?.length) return meta.pk
  if (meta?.columns?.includes('id')) return ['id']
  if (meta?.columns?.length) return [meta.columns[0]]
  return ['id']
}

// ── Dump one table ──────────────────────────────────────────────────────────

async function dumpTable(table, meta) {
  const { count, error: countError } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (countError) throw new Error(`count failed: ${countError.message}`)

  const order = orderColumns(meta)
  const rows = []

  for (let page = 0; page < MAX_PAGES_PER_TABLE; page++) {
    let query = db.from(table).select('*')
    for (const col of order) query = query.order(col, { ascending: true })
    const from = page * PAGE_SIZE
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`page ${page} (rows ${from}+) failed: ${error.message}`)
    const batch = data ?? []
    rows.push(...batch)
    // A short page means the end of the table. Never break on an empty result
    // alone — that would also be the (impossible-to-distinguish) symptom of a
    // paging bug, so the row-count assertion below is what actually proves the
    // read was complete.
    if (batch.length < PAGE_SIZE) break
    if (page === MAX_PAGES_PER_TABLE - 1) {
      throw new Error(`exceeded ${MAX_PAGES_PER_TABLE} pages — paging is not terminating`)
    }
  }

  // The check that makes this a backup rather than a hope. AUDIT.md #209: a
  // silently truncated export is worse than no export, because it looks fine.
  if (typeof count === 'number' && rows.length !== count) {
    throw new Error(
      `row count mismatch: read ${rows.length}, table reports ${count}. ` +
      `Either paging is broken or the table was written to mid-dump — re-run.`,
    )
  }

  return { rows, count: count ?? rows.length, orderedBy: order }
}

// ── Main ────────────────────────────────────────────────────────────────────

const startedAt = new Date()
const stamp = startedAt.toISOString().replace(/[:.]/g, '-')
const outDir = path.resolve(flagValue('--out-dir', path.join(repoRoot, 'backups')))

const repoTables = tablesFromRepo()
console.log(`Repo declares ${repoTables.size} table(s) across schema.sql + migrations.`)

let liveTables = null
let introspectionError = null
if (hasFlag('--skip-introspect')) {
  introspectionError = 'skipped via --skip-introspect'
  console.warn('WARNING: --skip-introspect set. Completeness cannot be proven; output will be marked INCOMPLETE.')
} else {
  try {
    liveTables = await introspectLive()
    console.log(`Live database exposes ${liveTables.size} table(s).`)
  } catch (err) {
    introspectionError = err instanceof Error ? err.message : String(err)
    console.error(`ERROR: could not introspect the live schema — ${introspectionError}`)
    console.error('Refusing to claim a complete backup without knowing what tables exist.')
    console.error('Re-run with --skip-introspect to take a best-effort (explicitly INCOMPLETE) dump anyway.')
    process.exit(1)
  }
}

const targets = liveTables
  ? [...liveTables.keys()].sort()
  : [...repoTables].sort()

const onlyInRepo = liveTables ? [...repoTables].filter(t => !liveTables.has(t)).sort() : []
const onlyInLive = liveTables ? [...liveTables.keys()].filter(t => !repoTables.has(t)).sort() : []

if (onlyInRepo.length) {
  console.warn(`\nNOTE: ${onlyInRepo.length} table(s) declared in the repo do not exist live (unapplied migrations?):`)
  console.warn(`  ${onlyInRepo.join(', ')}`)
}
if (onlyInLive.length) {
  console.warn(`\nNOTE: ${onlyInLive.length} live table(s) are not declared in the repo (backed up anyway):`)
  console.warn(`  ${onlyInLive.join(', ')}`)
}

console.log(`\nDumping ${targets.length} table(s)...\n`)

const data = {}
const tableStats = {}
const failures = []

for (const table of targets) {
  process.stdout.write(`  ${table} ... `)
  try {
    const { rows, count, orderedBy } = await dumpTable(table, liveTables?.get(table))
    data[table] = rows
    tableStats[table] = { rows: rows.length, reportedCount: count, orderedBy }
    console.log(`${rows.length} row(s)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    failures.push({ table, error: message })
    tableStats[table] = { rows: null, error: message }
    console.log(`FAILED — ${message}`)
  }
}

const complete = failures.length === 0 && !introspectionError

const payload = {
  manifest: {
    tool: 'scripts/backup-database.mjs',
    formatVersion: 1,
    complete,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    supabaseUrl,
    tableCount: targets.length,
    totalRows: Object.values(tableStats).reduce((sum, s) => sum + (s.rows ?? 0), 0),
    introspection: introspectionError ? { ok: false, reason: introspectionError } : { ok: true },
    schemaDrift: { declaredInRepoButNotLive: onlyInRepo, liveButNotDeclaredInRepo: onlyInLive },
    failures,
    notCovered: [
      'Supabase Storage object bytes (buckets: client-files, proposal-pdfs, company-files)',
      'auth schema (Supabase Auth users, identities, sessions)',
      'RLS policies, functions, triggers, indexes, enums, sequence positions, extensions',
    ],
    tables: tableStats,
  },
  data,
}

fs.mkdirSync(outDir, { recursive: true })
const filename = complete
  ? `gravhub-backup-${stamp}.json`
  : `gravhub-backup-${stamp}.INCOMPLETE.json`
const outPath = path.join(outDir, filename)
const tmpPath = `${outPath}.tmp`

// Write-then-rename: a killed process leaves a .tmp file, never a truncated
// file wearing a "complete backup" filename.
fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2))
fs.renameSync(tmpPath, outPath)

const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
console.log(`\n${complete ? 'Backup complete' : 'BACKUP INCOMPLETE'}: ${outPath} (${sizeMb} MB)`)
console.log(`${payload.manifest.totalRows} row(s) across ${targets.length} table(s).`)

if (!complete) {
  console.error('\nThis dump is NOT a usable backup:')
  if (introspectionError) console.error(`  - schema introspection: ${introspectionError}`)
  for (const f of failures) console.error(`  - ${f.table}: ${f.error}`)
  console.error('\nFix the errors above and re-run. Do not rely on this file.')
  process.exit(1)
}

console.log('\nReminder: Storage object bytes and the auth schema are NOT in this file.')
console.log('See docs/DISASTER-RECOVERY.md — this export supplements PITR, it does not replace it.')
