import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Every mutation under `/client/**` must go through `previewFetch`.
 *
 * AUDIT #506 built a two-part guard so an admin using "View as Client" can't
 * trigger real writes against that client's account: `previewFetch()` blocks
 * a non-GET before it reaches the network, and `blockIfPreview()` 403s
 * server-side anything carrying the header `previewFetch` attaches.
 *
 * The catch is that the two halves are coupled. The server half only fires on
 * requests that were tagged — and only `previewFetch` tags them. So a plain
 * `fetch()` in a `/client/**` page evades *both*: no client-side block, and
 * no header for the server to reject. `previewFetch`'s own doc comment
 * anticipated this, calling the server half "defense in depth against a
 * future call site that bypasses this wrapper". Four call sites did exactly
 * that (#763) — including marking a client's real notifications read, which
 * meant they never saw them, and submitting a quiz that wrote a real score
 * to their training record.
 *
 * A guard, not a sweep, because the failure is invisible: the write succeeds,
 * the UI looks right, and the damage lands in someone else's account.
 */

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Raw `fetch(` calls whose options object names a mutating method.
 *
 * Looks at a window rather than one line because these calls are written
 * across several lines, with `method:` on the line after the URL.
 */
function rawMutatingFetches(src: string): number[] {
  const lines = src.split('\n')
  const hits: number[] = []
  lines.forEach((line, i) => {
    // Comment lines can't perform a write, and the fix comments left at the
    // repaired call sites say "was a raw fetch()" — which the scan below
    // would otherwise flag as the very thing it documents fixing.
    if (/^\s*(\/\/|\/?\*)/.test(line)) return
    // `previewFetch(` also contains `fetch(`, so require it not be preceded
    // by the wrapper's name.
    if (!/(?<!preview)\bfetch\s*\(/.test(line)) return
    const window = lines.slice(i, i + 6).join(' ')
    if (!/method:\s*['"](POST|PATCH|PUT|DELETE)/i.test(window)) return
    hits.push(i + 1)
  })
  return hits
}

describe('View-as-Client write guard', () => {
  const files = walk(join(root, 'app/client'))
    .map(f => [f.replace(root + '/', ''), readFileSync(f, 'utf-8')] as const)

  it('is looking at the client portal at all', () => {
    // Guards against a path rename silently emptying the check.
    expect(files.length).toBeGreaterThan(5)
  })

  it('routes every /client mutation through previewFetch', () => {
    const offenders = files.flatMap(([file, src]) =>
      rawMutatingFetches(src).map(line =>
        `${file}:${line} — raw fetch() with a mutating method; use previewFetch(isPreview, ...)`))

    // Each entry is a write an admin could fire against a real client's
    // account while only previewing it.
    expect(offenders).toEqual([])
  })
})

/**
 * The API route file a `/api/...` URL resolves to, or null.
 *
 * Template holes (`${course.id}`) become wildcards, which match a dynamic
 * `[segment]` directory. A literal segment prefers an exact directory and
 * falls back to a dynamic one.
 */
function routeFileFor(url: string): string | null {
  const path = url.split('?')[0].replace(/^\/api\//, '')
  const wanted = path.split('/').map(s => (s.includes('${') ? '*' : s)).filter(Boolean)

  let dir = join(root, 'app/api')
  for (const seg of wanted) {
    const entries = readdirSync(dir).filter(e => statSync(join(dir, e)).isDirectory())
    const exact = seg !== '*' && entries.includes(seg) ? seg : null
    const dynamic = entries.find(e => e.startsWith('[')) ?? null
    const next = exact ?? dynamic
    if (!next) return null
    dir = join(dir, next)
  }
  const file = join(dir, 'route.ts')
  try {
    statSync(file)
  } catch {
    return null
  }
  return file.replace(root + '/', '')
}

describe('View-as-Client server-side half', () => {
  // Derived from the call sites rather than hand-listed. A hand-maintained
  // list is what let the enrollment *detail* route (what markModuleComplete
  // PATCHes) slip through while its sibling collection route was covered:
  // the list looked complete because it named a plausible neighbour.
  const targets = new Set<string>()
  for (const file of walk(join(root, 'app/client'))) {
    const src = readFileSync(file, 'utf-8')
    // previewFetch(isPreview, '<url>' | `<url>`, { ... method: 'POST' ... })
    //
    // The options object is scanned by slicing forward from the URL rather
    // than by matching up to a closing paren — a body built with
    // JSON.stringify({...}) closes several parens of its own, and anchoring
    // on one of them silently dropped call sites from this set.
    for (const m of src.matchAll(/previewFetch\([^,]+,\s*[`'"]([^`'"]+)[`'"]/g)) {
      const opts = src.slice(m.index + m[0].length, m.index + m[0].length + 200)
      if (!/method:\s*['"](POST|PATCH|PUT|DELETE)/i.test(opts)) continue
      const route = routeFileFor(m[1])
      if (route) targets.add(route)
    }
  }

  it('resolved the previewFetch call sites to real route files', () => {
    // If URL extraction or route resolution breaks, the check below would
    // pass vacuously against an empty set.
    expect(targets.size).toBeGreaterThan(5)
  })

  it('has blockIfPreview on every route a /client mutation targets', () => {
    // previewFetch tags the request; blockIfPreview rejects it. Losing the
    // server half turns the guard into a client-side-only suggestion.
    const missing = [...targets]
      .filter(f => !readFileSync(resolve(root, f), 'utf-8').includes('blockIfPreview'))
      .sort()
    expect(missing).toEqual([])
  })
})
