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

const here = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.argv[2] || 54321)
/** The seeded admin — matches tools/fixtures.json's team_members row. */
const SEED_EMAIL = 'jonathangraviss@gmail.com'

/** @type {Record<string, any[]>} */
const db = JSON.parse(readFileSync(join(here, 'fixtures.json'), 'utf-8'))
const unmodelled = new Set()

/** PostgREST encodes filters as `col=op.value`. */
function applyFilters(rows, params) {
  let out = rows
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue
    const m = /^(eq|neq|gt|gte|lt|lte|like|ilike|in|is|not)\.(.*)$/s.exec(raw)
    if (!m) continue
    const [, op, valRaw] = m
    const val = valRaw === 'null' ? null : valRaw
    out = out.filter(r => {
      const v = r[key]
      switch (op) {
        case 'eq':  return String(v) === String(val)
        case 'neq': return String(v) !== String(val)
        case 'gt':  return v > val
        case 'gte': return v >= val
        case 'lt':  return v < val
        case 'lte': return v <= val
        case 'is':  return val === null ? (v === null || v === undefined) : String(v) === String(val)
        case 'like':
        case 'ilike': {
          const re = new RegExp('^' + String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', op === 'ilike' ? 'i' : '')
          return v != null && re.test(String(v))
        }
        case 'in': {
          const set = String(val).replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
          return set.includes(String(v))
        }
        default: return true
      }
    })
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
      if (rows.length !== 1) return send(406, { message: 'JSON object requested, multiple (or no) rows returned' })
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
})

server.listen(PORT, () => console.error(`[fake-supabase] listening on ${PORT}`))

process.on('SIGTERM', () => {
  if (unmodelled.size) {
    console.error('[fake-supabase] the app asked for things this fake does not model:')
    for (const u of [...unmodelled].sort()) console.error('  -', u)
  }
  process.exit(0)
})
