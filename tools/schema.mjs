/**
 * Reads `supabase/schema.sql` and reports, per table, which columns are NOT
 * NULL and what they default to.
 *
 * Why this exists: `fixtures.json` is hand-written, and the first two
 * "findings" the browser harness produced were both phantoms — an Automations
 * page crash on `statusConfig[auto.status].dot` and a Contracts page crash on
 * `c.assignedRep.split(' ')`. Both columns are `not null default …` in the
 * real schema, so neither value can ever be null in a real database. The
 * fixtures had simply omitted them, and `fake-supabase` served the rows back
 * with the keys missing.
 *
 * That is the harness manufacturing bugs the app cannot have, which is the
 * same false confidence it was built to remove, only inverted — and more
 * expensive, because a phantom looks exactly like a find until you chase it.
 * So fixture rows are now treated the way Postgres treats an INSERT: any
 * omitted NOT NULL column takes its schema default, and a NOT NULL column
 * with no default is a hard error at startup rather than an `undefined` that
 * surfaces later as someone else's stack trace.
 *
 * Deliberately a small regex parser, not a SQL grammar. It handles the column
 * syntax this one file uses and nothing else; anything it cannot read it
 * reports rather than guesses at.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SUPABASE = join(here, '..', 'supabase')

/**
 * Every SQL file that can define or alter a table, in apply order.
 *
 * The first version of this read only `schema.sql`, which turned out to
 * define 28 of ~49 tables — the rest live across the migrations directory and
 * `schema_calendar.sql`. So the NOT NULL defaults it exists to apply were
 * silently skipped for 21 tables, including `signature_requests` and `tasks`.
 * That is the same failure the whole file is meant to prevent, one level up:
 * a check that looks thorough and quietly covers half of what you think.
 *
 * Migrations are sorted by filename, which is how Supabase applies them, so a
 * later `alter table … add column` overrides the original definition.
 */
function sqlFiles() {
  const out = []
  for (const f of ['schema.sql', 'schema_calendar.sql']) {
    const p = join(SUPABASE, f)
    if (existsSync(p)) out.push(p)
  }
  const migrations = join(SUPABASE, 'migrations')
  if (existsSync(migrations)) {
    for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
      out.push(join(migrations, f))
    }
  }
  return out
}

/** `'Active'` → Active; `0` → 0; `false` → false; `'{}'` (array) → []. */
function literal(raw, type) {
  const v = raw.trim().replace(/::[a-z_ \[\]]+$/i, '').trim()
  if (/^now\(\)$/i.test(v)) return new Date().toISOString()
  if (/^gen_random_uuid\(\)$/i.test(v)) return null // caller supplies ids
  if (/^'(.*)'$/s.test(v)) {
    const inner = v.slice(1, -1).replace(/''/g, "'")
    // `'{}'` against a `text[]` column is an empty array, not the string "{}".
    if (type.endsWith('[]')) {
      const body = inner.replace(/^\{|\}$/g, '')
      return body === '' ? [] : body.split(',').map(s => s.replace(/^"|"$/g, ''))
    }
    // ...and against jsonb it is an empty *object*. Handing the app the
    // string "{}" where it expects an object is exactly the kind of
    // shape mismatch this file exists to prevent — `settings.engagement.x`
    // would throw on a string rather than read undefined.
    if (/^jsonb?$/.test(type)) {
      try { return JSON.parse(inner) } catch { return undefined }
    }
    return inner
  }
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (/^'?\{\}'?$/.test(v)) return []
  return undefined
}

/** Parses one column definition line into its NOT NULL / default facts. */
function parseColumn(line) {
  const m = /^([a-z_0-9]+)\s+([a-z_0-9]+(?:\s*\[\])?(?:\([^)]*\))?)\s*(.*)$/i.exec(line)
  if (!m) return null
  const [, name, type, rest] = m
  // Only this column's own clauses count — anything after a comma belongs to
  // the next column in a multi-column statement.
  const own = rest.split(',')[0]
  const notNull = /\bnot null\b/i.test(own) || /\bprimary key\b/i.test(own)
  // Stop at a comma as well as at a following keyword: a multi-column
  // `alter table … add column a …, add column b …;` otherwise let b's
  // clauses bleed into a's definition, which marked nullable columns NOT
  // NULL and made valid defaults unparseable.
  const defMatch = /\bdefault\s+(.+?)(?:\s*,|\s+(?:not null|unique|references|check)\b|$)/i.exec(rest)
  return [name, {
    notNull,
    hasDefault: !!defMatch,
    default: defMatch ? literal(defMatch[1], type.toLowerCase()) : undefined,
  }]
}

/**
 * @returns {Record<string, Record<string, {notNull: boolean, default: unknown, hasDefault: boolean}>>}
 */
export function readSchema(paths = sqlFiles()) {
  const tables = {}
  for (const path of paths) {
    const sql = readFileSync(path, 'utf-8')

    const tableRe = /create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi
    let t
    while ((t = tableRe.exec(sql))) {
      const [, table, body] = t
      const cols = tables[table] ?? {}
      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim().replace(/,$/, '')
        if (!line || line.startsWith('--')) continue
        // Table-level constraints, not columns.
        if (/^(primary key|unique|foreign key|constraint|check)\b/i.test(line)) continue
        const parsed = parseColumn(line)
        if (parsed) cols[parsed[0]] = parsed[1]
      }
      tables[table] = cols
    }

    // `alter table x add column y ... not null default z` — 11 migrations use
    // this, and the columns they add are as NOT NULL as any other.
    // One statement can add several columns:
    //   alter table t add column a int not null default 0,
    //                 add column b text;
    // so split the body on each `add column` rather than parsing it whole.
    const alterRe = /alter table (?:if exists )?(?:public\.)?([a-z_0-9]+)\s+((?:add column|drop column)[^;]+);/gi
    let a
    while ((a = alterRe.exec(sql))) {
      const [, table, body] = a
      const parts = body.split(/,?\s*add column\s+(?:if not exists\s+)?/i).slice(1)
      for (const part of parts) {
        const parsed = parseColumn(part.trim().replace(/\s+/g, ' '))
        if (!parsed) continue
        tables[table] = tables[table] ?? {}
        tables[table][parsed[0]] = parsed[1]
      }
    }

    // A dropped column must not keep contributing a default.
    const dropRe = /alter table (?:if exists )?(?:public\.)?([a-z_0-9]+)\s+drop column (?:if exists )?([a-z_0-9]+)/gi
    let d
    while ((d = dropRe.exec(sql))) {
      const [, table, col] = d
      if (tables[table]) delete tables[table][col]
    }
  }
  return tables
}

/**
 * Fills a fixture row's omitted NOT NULL columns from their schema defaults,
 * the way an INSERT would.
 *
 * @returns {{row: object, missing: string[]}} `missing` names NOT NULL columns
 * with no default that the row also failed to supply — those are real fixture
 * errors and the caller should refuse to start.
 */
export function applyDefaults(table, row, schema) {
  const cols = schema[table]
  if (!cols) return { row, missing: [] }
  const out = { ...row }
  const missing = []
  for (const [name, col] of Object.entries(cols)) {
    if (out[name] !== undefined) continue
    if (!col.notNull) continue
    if (col.hasDefault && col.default !== undefined) { out[name] = col.default; continue }
    missing.push(name)
  }
  return { row: out, missing }
}
