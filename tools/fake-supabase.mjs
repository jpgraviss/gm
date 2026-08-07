/**
 * A minimal stand-in for Supabase's PostgREST API, for driving the real app
 * in a browser without a database.
 *
 * Why this exists: every authenticated flow in GravHub was unverifiable in
 * CI. The suite mocks `createServiceClient` per-test, which proves a handler
 * behaves given a fake row but never proves the *page* renders it, that the
 * numbers add up, or that a flow completes. AUDIT #773 (signature links
 * bouncing external recipients to /login) sat undetected through ~770
 * source-level findings and was obvious within a minute of opening the page.
 *
 * This is deliberately not a Postgres. It speaks just enough PostgREST for
 * the app's client: table reads with the filters the app actually sends,
 * writes that persist in memory for the life of the process, and RPCs that
 * apply the same increments their SQL counterparts do. When the app asks for
 * something this doesn't model, it says so on stderr rather than silently
 * returning [] — a fake that quietly answers "no rows" would manufacture
 * exactly the kind of false confidence this is meant to remove.
 *
 * Run: node tools/fake-supabase.mjs [port]
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readSchema, applyDefaults } from './schema.mjs'
import { usedTables } from './used-tables.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.argv[2] || 54321)
/** The seeded admin — matches tools/fixtures.json's team_members row. */
const SEED_EMAIL = 'jonathangraviss@gmail.com'

/** @type {Record<string, any[]>} */
const db = JSON.parse(readFileSync(join(here, 'fixtures.json'), 'utf-8'))
const unmodelled = new Set()

// Fixture rows are INSERTs, so treat them like Postgres would: an omitted NOT
// NULL column takes its schema default. Without this the fake serves rows with
// keys simply absent, and the app crashes on values the real database
// guarantees are present — `statusConfig[auto.status].dot` and
// `c.assignedRep.split(' ')` both did exactly that, and both looked like real
// findings until the schema said otherwise. See tools/schema.mjs.
const schema = readSchema()
{
  const errors = []
  for (const [table, rows] of Object.entries(db)) {
    if (!schema[table]) continue
    rows.forEach((row, i) => {
      const { row: filled, missing } = applyDefaults(table, row, schema)
      rows[i] = filled
      for (const col of missing) errors.push(`${table}[${i}] (id=${row.id ?? '?'}) missing NOT NULL column with no default: ${col}`)
    })
  }
  // A fixture table the app never reads is dead weight that looks like data.
  // Four had accumulated, all misnamed (`tasks` for `app_tasks`, `pipelines`
  // for config that lives in app_settings), and each made its page render
  // empty — indistinguishable from the app failing to show its data. See
  // tools/used-tables.mjs.
  const used = usedTables()
  for (const table of Object.keys(db)) {
    if (!used.has(table)) errors.push(`no code queries table "${table}" — check the name against a .from('…') call site`)
  }

  if (errors.length) {
    console.error('[fake-supabase] fixtures.json does not match the app:')
    for (const e of errors) console.error('  -', e)
    process.exit(1)
  }
}

/**
 * Thrown when a query uses something this fake does not implement.
 *
 * Refusing to answer is the whole point. The first version of `applyFilters`
 * did `if (!m) continue` on any operator it did not recognise, which means an
 * unimplemented filter *widened* the result set instead of narrowing it — the
 * fake was strictly more permissive than PostgREST, silently. Four of the
 * app's query operators landed in that branch: `cs` (13 call sites), `ov` (4),
 * `not` (33), and the top-level `or=` (20). The bill came due on
 * `POST /api/crm/contacts`, whose duplicate check is
 * `.overlaps('emails', emails).limit(1).maybeSingle()`. With `ov` ignored that
 * matched the first contact in the table, so every attempt to create a contact
 * — any contact, any email — came back 409 "already exists". A real
 * application bug and a fake that invents one are indistinguishable from the
 * outside, and this one had been quietly in place for every crawl so far.
 */
class UnmodelledQuery extends Error {}

/** Splits `a.eq.1,b.eq.2` on top-level commas, ignoring those inside (…) or {…}. */
function splitTopLevel(s) {
  const out = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(' || ch === '{') depth++
    else if (ch === ')' || ch === '}') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** `{a,b}` and `{"k":"v"}` — PostgREST's array and jsonb literals. */
function parseSetLiteral(raw) {
  const inner = raw.replace(/^\{|\}$/g, '')
  if (!inner) return []
  return inner.split(',').map(s => s.replace(/^"|"$/g, ''))
}

const asArray = v => (Array.isArray(v) ? v : v == null ? [] : [v])

/**
 * Turns one `op.value` clause into a predicate.
 *
 * `col` is the column; `expr` is everything after the `=`. Unknown operators
 * throw rather than pass — see `UnmodelledQuery`.
 */
function makePredicate(col, expr) {
  const m = /^([a-z]+)\.(.*)$/s.exec(expr)
  if (!m) throw new UnmodelledQuery(`cannot parse filter ${col}=${expr}`)
  const [, op, rest] = m

  // `.not('col', 'is', null)` arrives as `col=not.is.null`.
  if (op === 'not') {
    const inner = makePredicate(col, rest)
    return r => !inner(r)
  }

  const val = rest === 'null' ? null : rest
  switch (op) {
    case 'eq':  return r => String(r[col]) === String(val)
    case 'neq': return r => String(r[col]) !== String(val)
    case 'gt':  return r => r[col] > val
    case 'gte': return r => r[col] >= val
    case 'lt':  return r => r[col] < val
    case 'lte': return r => r[col] <= val
    case 'is':  return r => (val === null ? (r[col] === null || r[col] === undefined) : String(r[col]) === String(val))
    case 'like':
    case 'ilike': {
      const re = new RegExp(
        '^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$',
        op === 'ilike' ? 'i' : '',
      )
      return r => r[col] != null && re.test(String(r[col]))
    }
    case 'in': {
      // `in.("a","b")` — parenthesised, unlike the brace-delimited set types.
      const values = String(val).replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
      return r => values.includes(String(r[col]))
    }
    // `.contains(col, [...])` — every listed element must be present.
    case 'cs': {
      const wanted = parseSetLiteral(String(val))
      return r => { const have = asArray(r[col]).map(String); return wanted.every(w => have.includes(w)) }
    }
    // `.containedBy(col, [...])` — every stored element must be listed.
    case 'cd': {
      const allowed = parseSetLiteral(String(val)).map(String)
      return r => asArray(r[col]).map(String).every(v => allowed.includes(v))
    }
    // `.overlaps(col, [...])` — the two sets share at least one element.
    case 'ov': {
      const wanted = parseSetLiteral(String(val)).map(String)
      return r => asArray(r[col]).map(String).some(v => wanted.includes(v))
    }
    default:
      throw new UnmodelledQuery(`filter operator "${op}" is not implemented (${col}=${expr})`)
  }
}

/** PostgREST encodes filters as `col=op.value`, plus a top-level `or=(…)`. */
function applyFilters(rows, params) {
  let out = rows
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'apikey', 'on_conflict'].includes(key)) continue

    // `.or('a.eq.1,b.eq.2')` → `or=(a.eq.1,b.eq.2)`, any clause matching.
    if (key === 'or' || key === 'and') {
      const clauses = splitTopLevel(raw.replace(/^\(|\)$/g, '')).map(c => {
        const dot = c.indexOf('.')
        if (dot < 0) throw new UnmodelledQuery(`cannot parse ${key} clause "${c}"`)
        return makePredicate(c.slice(0, dot), c.slice(dot + 1))
      })
      out = out.filter(r => (key === 'or' ? clauses.some(p => p(r)) : clauses.every(p => p(r))))
      continue
    }

    const pred = makePredicate(key, raw)
    out = out.filter(pred)
  }
  return out
}

function applyOrderLimit(rows, params) {
  const order = params.get('order')
  if (order) {
    const [col, dir] = order.split('.')
    rows = [...rows].sort((a, b) => {
      const av = a[col], bv = b[col]
      if (av === bv) return 0
      const cmp = av > bv ? 1 : -1
      return dir === 'desc' ? -cmp : cmp
    })
  }
  const limit = params.get('limit')
  if (limit) rows = rows.slice(0, Number(limit))
  return rows
}

/** Mirrors the increments the real RPCs perform, so counter flows are real. */
function runRpc(name, args) {
  const bump = (table, id, col, extra = {}) => {
    const row = (db[table] || []).find(r => r.id === id)
    if (row) Object.assign(row, { [col]: (row[col] ?? 0) + 1 }, extra)
  }
  switch (name) {
    case 'increment_broadcast_counter':  bump('broadcasts', args.p_id, args.p_column); return null
    case 'increment_automation_runs':    bump('automations', args.p_id, 'runs', { last_run: new Date().toISOString() }); return null
    case 'increment_kb_article_views':   bump('knowledge_articles', args.p_id, 'views'); return null
    case 'increment_kb_article_feedback':bump('knowledge_articles', args.p_id, args.p_column); return null
    default:
      unmodelled.add(`rpc:${name}`)
      return null
  }
}

const server = createServer(async (req, res) => {
  try {
    await handle(req, res)
  } catch (err) {
    if (!(err instanceof UnmodelledQuery)) throw err
    // A query this fake cannot answer correctly. Saying so — loudly, with a
    // 501 the app will surface as an error rather than as data — is the only
    // safe response: the alternative is returning rows that a real PostgREST
    // would not have, which is how a fake starts inventing findings.
    unmodelled.add(`query:${err.message}`)
    console.error(`[fake-supabase] ${req.url}\n  ${err.message}`)
    res.writeHead(501, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify({ code: 'HARNESS', message: err.message, details: null, hint: null }))
  }
})

async function handle(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const send = (code, body) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      // supabase-js sends `apikey` and `authorization`, both non-simple, so
      // the browser preflights every call. Without these two headers the
      // preflight fails and the request never leaves the tab — which
      // surfaces as ERR_CONNECTION_RESET rather than anything CORS-shaped.
      'Access-Control-Allow-Headers': '*, apikey, authorization, content-type, x-client-info, prefer, range',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'content-range, x-next-cursor',
      'Access-Control-Max-Age': '600',
    })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }
  if (req.method === 'OPTIONS') return send(204)

  // Supabase auth. The browser client calls `supabase.auth.getUser()` to
  // decide who is signed in — the httpOnly session cookie only authenticates
  // the *server*, so without this the UI treats every visitor as anonymous
  // and AppShell redirects to /login.
  if (url.pathname.startsWith('/auth/v1/')) {
    const user = {
      id: 'tm-jonathan',
      aud: 'authenticated',
      role: 'authenticated',
      email: SEED_EMAIL,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Jonathan Graviss' },
      created_at: '2026-01-01T00:00:00Z',
    }
    if (url.pathname.endsWith('/user')) return send(200, user)
    return send(200, {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    })
  }

  const rpc = /^\/rest\/v1\/rpc\/(.+)$/.exec(url.pathname)
  if (rpc) {
    let body = ''
    for await (const c of req) body += c
    return send(200, runRpc(rpc[1], body ? JSON.parse(body) : {}))
  }

  const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1]
  if (!table) return send(404, { message: `unhandled path ${url.pathname}` })

  if (!(table in db)) {
    unmodelled.add(`table:${table}`)
    db[table] = []
  }

  if (req.method === 'GET') {
    const rows = applyOrderLimit(applyFilters(db[table], url.searchParams), url.searchParams)
    // `.single()` sends Accept: application/vnd.pgrst.object+json
    if ((req.headers.accept || '').includes('object')) {
      if (rows.length !== 1) {
        // The `code` matters as much as the status. Routes branch on it —
        // `if (error?.code === 'PGRST116') return NextResponse.json(null)` is
        // how "no row yet" is told apart from a real failure. An earlier
        // version of this fake sent the message without the code, so that
        // guard missed and GET /api/calendar/settings appeared to 500 for
        // any user who had never configured a calendar. The app was right;
        // the fake was lying. Match PostgREST's body exactly.
        return send(406, {
          code: 'PGRST116',
          details: `The result contains ${rows.length} rows`,
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned',
        })
      }
      return send(200, rows[0])
    }
    return send(200, rows)
  }

  let raw = ''
  for await (const c of req) raw += c
  const payload = raw ? JSON.parse(raw) : {}

  if (req.method === 'POST') {
    const incoming = Array.isArray(payload) ? payload : [payload]
    for (const row of incoming) {
      if (!row.id) row.id = `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      // Same INSERT semantics the fixtures get at startup, so a row the app
      // creates mid-run is shaped like one the real database would return.
      Object.assign(row, applyDefaults(table, row, schema).row)
      const existing = db[table].findIndex(r => r.id === row.id)
      if (existing >= 0) db[table][existing] = { ...db[table][existing], ...row }
      else db[table].push(row)
    }
    return send(201, Array.isArray(payload) ? incoming : incoming[0])
  }

  if (req.method === 'PATCH') {
    const hits = applyFilters(db[table], url.searchParams)
    hits.forEach(r => Object.assign(r, payload))
    return send(200, hits)
  }

  if (req.method === 'DELETE') {
    const hits = new Set(applyFilters(db[table], url.searchParams))
    db[table] = db[table].filter(r => !hits.has(r))
    return send(200, [...hits])
  }

  return send(405, { message: `unhandled method ${req.method}` })
}

server.listen(PORT, () => console.error(`[fake-supabase] listening on ${PORT}`))

process.on('SIGTERM', () => {
  if (unmodelled.size) {
    console.error('[fake-supabase] the app asked for things this fake does not model:')
    for (const u of [...unmodelled].sort()) console.error('  -', u)
  }
  process.exit(0)
})
