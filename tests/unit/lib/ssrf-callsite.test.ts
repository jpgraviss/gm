import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Server-side `fetch()` must not be aimed by data.
 *
 * The app fetches a lot of URLs that come from outside it: a monitored
 * site, a client's website field, a WordPress install, a form's outbound
 * webhook, a URL typed into the SEO audit box. Each of those is a request
 * the server makes on someone else's say-so, so each needs the hostname
 * resolved once, checked against the private/internal ranges, and the
 * connection pinned to that exact address — otherwise a second DNS lookup
 * can answer differently (#319) and a redirect can walk somewhere new
 * (#292).
 *
 * `lib/ssrf-guard.ts`, `lib/website-fetch.ts` and `wpSafeFetch` all exist
 * to do that. The recurring failure is not that they are wrong; it is that
 * a new call site simply doesn't use them. That has now happened eight
 * times: #260, #292, #319, #414, #500, #568, and three more in #764 — an
 * SEO audit endpoint that fetched any URL a staff member typed and fed
 * 30KB of the response into stored output, a CRM route that fetched a
 * company's website field, and a WordPress sync that additionally handed
 * the GravHub API key to whatever the site redirected to.
 *
 * So: a guard, and the allowlist below is the whole point of it. Adding an
 * entry should feel like a decision.
 */

const root = resolve(__dirname, '../../..')

/**
 * Call sites whose URL cannot be aimed by anything outside the codebase.
 * Each was traced to its source. Keyed by file and the literal argument
 * text so a line-number shift doesn't require an edit here.
 */
const ALLOWED: Record<string, string[]> = {
  // Same-origin. `url` is built from a pathname+search, never a host.
  'lib/fetch-all-pages.ts': ['url.pathname + url.search'],
  // Client-side helpers that call this app's own /api routes.
  'lib/supabase.ts': ['url'],
  'lib/use-api.ts': ['url'],
  // `url` is an env-configured provider endpoint (OLLAMA_URL) or one of the
  // module's constant provider bases — operator-controlled, not user data.
  'lib/ai-client.ts': ['url'],
  // Both take a full URL, and every caller in the module builds it from a
  // literal googleapis.com base.
  'lib/google-analytics.ts': ['url'],
  'lib/google-business-profile.ts': ['url'],
  // Built from the DRIVE_API constant a few lines above.
  'lib/google-drive.ts': ['downloadUrl'],
  // Built from BASE, a module constant.
  'lib/maverick.ts': ['url.toString()'],
  // Meta's own `paging.next` cursor, from a response that came from
  // META_GRAPH_BASE. Not reachable by app data.
  'lib/meta-ads.ts': ['url'],
  // This *is* the guard — the fetch it performs is the validated one.
  'lib/ssrf-guard.ts': ['url'],
  // ENGAGEMENT_CONFIGS is a module constant object of hubapi.com URLs.
  'app/api/integrations/hubspot/engagements/route.ts': ['`${config.url}?${params}`'],
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) out.push(full)
  }
  return out
}

/**
 * The argument expression between `fetch(` and the top-level comma/paren.
 *
 * Quotes and backticks open *and* close with the same character, so they
 * toggle rather than nest — counting them as depth means the scan never
 * unwinds and swallows the rest of the call.
 */
function urlArgument(src: string, from: number): string {
  let depth = 0
  let quote: string | null = null
  // Nesting of `${…}` holes inside the template currently being scanned.
  // A hole's contents are skipped wholesale, so its commas and parens never
  // reach the top-level counters below.
  let hole = 0
  for (let i = from; i < src.length && i < from + 400; i++) {
    const ch = src[i]
    if (ch === '\\') { i++; continue }
    if (quote) {
      if (ch === '$' && quote === '`' && src[i + 1] === '{') { hole++; i++ }
      else if (ch === '}' && hole > 0) hole--
      else if (ch === quote && hole === 0) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) {
      if (depth === 0) return src.slice(from, i).trim()
      depth--
    } else if (ch === ',' && depth === 0) return src.slice(from, i).trim()
  }
  return src.slice(from, from + 120).trim()
}

/**
 * True when the host can't be influenced by data — a literal absolute URL,
 * a SCREAMING_SNAKE module constant (this codebase's convention for API
 * bases: GOOGLE_TOKEN_URL, META_GRAPH_BASE, DRIVE_API, …), or a path-only
 * same-origin request.
 */
function hasFixedHost(arg: string): boolean {
  if (/^['"`]https?:\/\/[^'"`$]+/.test(arg)) return true
  if (/^[`'"]\$\{[A-Z][A-Z0-9_]*\}/.test(arg)) return true
  if (/^[A-Z][A-Z0-9_]*(,|$)/.test(arg)) return true
  if (/^['"`]\//.test(arg)) return true
  // Internal self-call against this app's own configured origin.
  if (/^[`'"]\$\{(baseUrl|baseUrl2|appUrl)\}/.test(arg)) return true
  return false
}

function offendersIn(file: string, src: string): string[] {
  const rel = file.replace(root + '/', '')
  const lineStarts: number[] = [0]
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1)
  const lineOf = (idx: number) => lineStarts.filter(s => s <= idx).length

  const out: string[] = []
  for (const m of src.matchAll(/\bfetch\s*\(/g)) {
    const idx = m.index!
    // A comment mentioning fetch() isn't a request. #763's guard learned
    // this the hard way — its own fix comments tripped it.
    const lineStart = src.lastIndexOf('\n', idx) + 1
    if (/^\s*(\/\/|\/?\*)/.test(src.slice(lineStart, idx + 1))) continue
    // The safe wrappers all end in `Fetch`/`fetch` themselves.
    if (/(wpSafe|preview|gbp|ga4|node)$/i.test(src.slice(Math.max(0, idx - 12), idx))) continue

    const arg = urlArgument(src, idx + m[0].length)
    if (hasFixedHost(arg)) continue
    // Pinned to an address the guard already validated.
    if (/dispatcher/.test(src.slice(idx, idx + 400))) continue
    if ((ALLOWED[rel] ?? []).includes(arg)) continue

    out.push(`${rel}:${lineOf(idx)} — fetch(${arg}) — host comes from data; use fetchSafeHtml/wpSafeFetch, or allowlist it`)
  }
  return out
}

describe('server-side SSRF call sites', () => {
  // Server code only. A fetch in a client component runs in the user's own
  // browser and can't reach the server's network.
  const files = [...walk(join(root, 'lib')), ...walk(join(root, 'app/api'))]
    .filter(f => !/useClientCompany|push-client|optimistic|api-mutate|kb-views/.test(f))

  it('is looking at the server at all', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('has an allowlist that still corresponds to real call sites', () => {
    // A stale allowlist entry is how a guard quietly stops guarding: the
    // code moves on, the exemption stays, and the next call site inherits
    // an exemption nobody re-examined.
    const stale: string[] = []
    for (const [rel, args] of Object.entries(ALLOWED)) {
      const src = readFileSync(resolve(root, rel), 'utf-8')
      for (const arg of args) {
        if (!src.includes(`fetch(${arg}`)) stale.push(`${rel} — no fetch(${arg}`)
      }
    }
    expect(stale).toEqual([])
  })

  it('routes every data-aimed server fetch through the SSRF guard', () => {
    const offenders = files.flatMap(f => offendersIn(f, readFileSync(f, 'utf-8'))).sort()
    expect(offenders).toEqual([])
  })
})
