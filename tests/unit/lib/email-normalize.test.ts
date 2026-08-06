import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeEmail, suppressionSet } from '@/lib/email-normalize'

/**
 * AUDIT #750 — "do not email this person" has to survive a capital letter.
 *
 * `sequence_suppression_list` is the app's unsubscribe/bounce/complaint
 * record. `app/api/sequences/[id]/enroll/route.ts` states the invariant in a
 * comment — *"emails stored lowercase"* — but nothing enforced it, and the
 * readers honoured it inconsistently:
 *
 *  - Four call sites built their lookup `Set` from `row.email` exactly as the
 *    DB returned it, then tested a lowercased needle against it. A row stored
 *    with capitals was invisible to all four.
 *  - `lib/automations-engine.ts` compared a RAW contact address against the
 *    list without lowercasing either side — and contact addresses genuinely
 *    carry mixed case, because `POST /api/crm/contacts` stores `body.emails`
 *    verbatim and the CSV import lowercases only for its dedupe check.
 *
 * The failure is one-directional and silent: the check misses, and the person
 * who unsubscribed gets the next broadcast. Nothing errors.
 */

describe('normalizeEmail', () => {
  it('folds case and surrounding whitespace', () => {
    expect(normalizeEmail('  John.Smith@Acme.COM ')).toBe('john.smith@acme.com')
  })

  it('maps absent values to empty rather than throwing', () => {
    // Contact rows legitimately have `emails: null`; a throw here would take
    // down a whole broadcast send.
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail('')).toBe('')
  })

  it('leaves the address otherwise untouched', () => {
    // Deliberately does NOT strip +tags or gmail dots. Those are different
    // mailboxes to some providers, and silently suppressing a distinct
    // address is a worse error than the one being fixed.
    expect(normalizeEmail('a+promo@example.com')).toBe('a+promo@example.com')
    expect(normalizeEmail('a.b@example.com')).toBe('a.b@example.com')
  })
})

describe('suppressionSet', () => {
  it('matches a legacy row stored with capitals', () => {
    // The actual bug. Rows written before this fix keep their original case,
    // so normalizing only on the needle side would still miss them.
    const set = suppressionSet([{ email: 'John@Acme.com' }])
    expect(set.has(normalizeEmail('john@acme.com'))).toBe(true)
  })

  it('matches a raw contact address against a lowercase row', () => {
    const set = suppressionSet([{ email: 'john@acme.com' }])
    expect(set.has(normalizeEmail('John@Acme.com'))).toBe(true)
  })

  it('survives null rows and null emails', () => {
    expect(suppressionSet(null).size).toBe(0)
    expect(suppressionSet([{ email: null }]).size).toBe(0)
  })

  it('does not suppress an unrelated address', () => {
    // Guards the opposite failure: over-suppressing silently stops mail the
    // recipient did want.
    const set = suppressionSet([{ email: 'john@acme.com' }])
    expect(set.has(normalizeEmail('jane@acme.com'))).toBe(false)
  })
})

describe('every suppression-list consumer normalizes', () => {
  // A call-site guard rather than a behaviour test, for the same reason as
  // tests/unit/lib/mrr-callsite-sync.test.ts: the bug is that ONE reader
  // forgot, and unit-testing the helper can't see that. A new consumer that
  // rebuilds the raw `Set` inline is the exact regression to catch.
  const CONSUMERS = [
    'lib/broadcasts.ts',
    'lib/review-campaigns.ts',
    'lib/automations-engine.ts',
    'app/api/broadcasts/[id]/audience/route.ts',
    'app/api/sequences/[id]/enroll/route.ts',
    'app/api/sequences/execute/route.ts',
    'app/api/reputation/send-request/route.ts',
  ]

  const root = resolve(__dirname, '../../..')
  const sources = CONSUMERS.map(f => [f, readFileSync(resolve(root, f), 'utf-8')] as const)

  it('reads the files it claims to check', () => {
    for (const [file, src] of sources) {
      expect(src, `${file} is empty or unreadable`).toContain('sequence_suppression_list')
    }
  })

  it('builds no lookup set straight from the raw DB value', () => {
    // `new Set(rows.map(r => r.email))` is the shape that was wrong in four
    // places. suppressionSet() is the replacement.
    const offenders = sources
      .filter(([, src]) => /new Set\(\([\w]+ \?\? \[\]\)\.map\(\([sr]: \{ email: string \}\) => [sr]\.email\)\)/.test(src))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  /**
   * The query chain hanging off each `.from('sequence_suppression_list')`.
   *
   * Scoping to the chain matters: a first version scanned whole files for
   * `.eq('email', …)` and flagged `lookupGmailToken`'s lookup against
   * `team_members`, which has nothing to do with suppression. A guard that
   * reports unrelated code gets muted, so it has to know which table it is
   * looking at.
   */
  function suppressionChains(src: string): string[] {
    return [...src.matchAll(/\.from\('sequence_suppression_list'\)/g)]
      // Spans BOTH directions. The value compared against the table is often
      // normalized where it is defined, a few lines above the query
      // (`allEmails`, `email.trim().toLowerCase()`), not inline in the
      // `.eq()`. A forward-only window flagged both of those as violations —
      // and a guard that cries wolf on correct code is one nobody keeps.
      .map(m => src.slice(Math.max(0, m.index! - 500), m.index! + 400))
  }

  it('finds the suppression queries at all', () => {
    const total = sources.reduce((n, [, src]) => n + suppressionChains(src).length, 0)
    expect(total).toBeGreaterThanOrEqual(CONSUMERS.length)
  })

  /** The argument to `.eq/.ilike/.in('email', …)`, paren-balanced. */
  function emailComparisonArg(chain: string): string | null {
    const m = chain.match(/\.(?:eq|ilike|in)\('email',\s*/)
    if (!m) return null
    let depth = 0
    const from = m.index! + m[0].length
    for (let i = from; i < chain.length; i++) {
      const c = chain[i]
      if (c === '(' || c === '[') depth++
      else if (c === ']') depth--
      else if (c === ')') {
        if (depth === 0) return chain.slice(from, i)
        depth--
      }
    }
    return null
  }

  /**
   * Variables normalized where they are DEFINED rather than at the call.
   *
   * An explicit list, not an inferred one. Two smarter versions failed:
   * scanning the window for the word "normalizeEmail" passed a mutation that
   * restored the original bug verbatim (the normalized variable was still
   * declared one line above, just no longer the value being passed), and
   * chasing the definition by regex either missed `allEmails` — normalized
   * across a three-line chain — or, when widened enough to catch it, let the
   * mutation back through.
   *
   * So: each name here was verified by reading its definition, and anything
   * NOT listed is an offender by default. Adding a name is a deliberate act
   * that says "I read this definition and it normalizes", which is exactly
   * the review this check exists to force.
   */
  const PRE_NORMALIZED = new Set([
    'allEmails',            // lib/broadcasts.ts — .map(e => e.toLowerCase())
    'normalizedEmails',     // app/api/sequences/[id]/enroll/route.ts
    'normalizedContactEmail', // lib/automations-engine.ts — normalizeEmail(contactEmail)
  ])

  it('normalizes the value compared against the suppression table', () => {
    // Resolves the ARGUMENT rather than scanning the window for the word
    // "normalizeEmail". A window-presence check passed a mutation that
    // restored the original bug verbatim — the normalized variable was still
    // declared one line above, just no longer the thing being passed. That
    // is the same "file mentions the right identifier somewhere" weakness
    // that made the first version of the MRR call-site guard useless.
    const offenders: string[] = []
    for (const [file, src] of sources) {
      for (const chain of suppressionChains(src)) {
        const arg = emailComparisonArg(chain)
        if (arg === null) continue
        if (/normalizeEmail|toLowerCase/.test(arg)) continue

        const ident = arg.trim()
        if (!PRE_NORMALIZED.has(ident)) offenders.push(`${file}: .eq('email', ${ident})`)
      }
    }
    expect(offenders).toEqual([])
  })
})
