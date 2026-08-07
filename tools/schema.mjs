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
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SCHEMA = join(here, '..', 'supabase', 'schema.sql')

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
    return inner
  }
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (/^'?\{\}'?$/.test(v)) return []
  return undefined
}

/**
 * @returns {Record<string, Record<string, {notNull: boolean, default: unknown, hasDefault: boolean}>>}
 */
export function readSchema(path = SCHEMA) {
  const sql = readFileSync(path, 'utf-8')
  const tables = {}
  const tableRe = /create table if not exists public\.([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/g
  let t
  while ((t = tableRe.exec(sql))) {
    const [, table, body] = t
    const cols = {}
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '')
      if (!line || line.startsWith('--')) continue
      // Table-level constraints, not columns.
      if (/^(primary key|unique|foreign key|constraint|check)\b/i.test(line)) continue
      const m = /^([a-z_0-9]+)\s+([a-z_0-9]+(?:\s*\[\])?(?:\([^)]*\))?)\s*(.*)$/i.exec(line)
      if (!m) continue
      const [, name, type, rest] = m
      const notNull = /\bnot null\b/i.test(rest) || /\bprimary key\b/i.test(rest)
      const defMatch = /\bdefault\s+(.+?)(?:\s+(?:not null|unique|references|check)\b|$)/i.exec(rest)
      cols[name] = {
        notNull,
        hasDefault: !!defMatch,
        default: defMatch ? literal(defMatch[1], type.toLowerCase()) : undefined,
      }
    }
    tables[table] = cols
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
