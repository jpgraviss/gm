import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { escapeHtml } from '@/lib/html-escape'

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) out.push(full)
  }
  return out
}

describe('escapeHtml', () => {
  it('escapes all five characters that matter', () => {
    expect(escapeHtml(`<a href="x" title='y'>&`))
      .toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;')
  })

  it('escapes the ampersand first, so nothing is double-encoded', () => {
    // If `&` were replaced last, the `&` of `&lt;` would itself be escaped
    // and the output would render as the literal text "&lt;".
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('cannot break out of a double-quoted attribute', () => {
    // AUDIT #766 — the real defect. `lib/uptime.ts` rendered a monitored
    // site's URL as href="${escapeHtml(url)}" using a copy that escaped only
    // & < >, so a quote in the stored URL closed the attribute and could add
    // its own. Monitored-site URLs are stored raw: the route validates with
    // `new URL()` but discards the result.
    const hostile = 'https://evil.test/"onmouseover="alert(1)'
    const escaped = escapeHtml(hostile)
    // The payload text survives — inertly, as part of the attribute's value.
    // What must not survive is a raw quote, because that is what would end
    // the attribute and let `onmouseover` become an attribute of its own.
    expect(escaped).not.toContain('"')
    const attr = `<a href="${escaped}">x</a>`
    expect(attr.match(/"/g)).toHaveLength(2)
  })

  it('cannot break out of a single-quoted attribute', () => {
    const escaped = escapeHtml("a'onerror='x")
    expect(escaped).not.toContain("'")
    const attr = `<a href='${escaped}'>y</a>`
    expect(attr.match(/'/g)).toHaveLength(2)
  })

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Acme Marketing — Q3 report')).toBe('Acme Marketing — Q3 report')
  })
})

describe('no module re-implements it', () => {
  /**
   * There were sixteen copies in three different strengths (#766). The weak
   * ones were not obviously weak at the call site — that is the whole
   * problem. A seventeenth would reintroduce the same drift.
   */
  it('has exactly one escapeHtml definition in the codebase', () => {
    const offenders = [...walk(join(root, 'lib')), ...walk(join(root, 'app'))]
      .filter(f => f !== join(root, 'lib/html-escape.ts'))
      .filter(f => /function escapeHtml\b|const escapeHtml\s*=/.test(readFileSync(f, 'utf-8')))
      .map(f => f.replace(root + '/', ''))

    expect(offenders).toEqual([])
  })

  it('is looking at the codebase at all', () => {
    expect(walk(join(root, 'lib')).length).toBeGreaterThan(20)
  })
})
