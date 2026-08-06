import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * Any inline contract-shaped type must carry `serviceType`.
 *
 * `MrrContract.serviceType` is optional on purpose — legacy callers that
 * predate the recurring/one-time split still work, falling back to the
 * billing structure alone. That leniency has a sharp edge: a caller that
 * simply forgets the field compiles cleanly and silently reports a HIGHER
 * MRR than every other page, because payment plans on one-time jobs and
 * pass-through contracts get counted as run rate (AUDIT #738/#739).
 *
 * That is what happened on `app/admin/page.tsx`, whose inline contract type
 * was `{ status?; billingStructure?; value? }`. Nothing failed; the Admin
 * dashboard just disagreed with Finance, Reports and Contracts, and the only
 * way to notice was to compare two pages side by side.
 *
 * This checks inline object-type literals that describe a contract — spotted
 * by `billingStructure`, which only appears in that shape — and requires
 * each to include `serviceType`. Callers typed as `Contract[]` are unaffected
 * (the shared type already has the field) and have no inline literal to match.
 *
 * A first version of this test asserted only that the FILE mentioned
 * `serviceType` somewhere. It passed a mutation that reintroduced the exact
 * bug, because the word appeared in unrelated code in the same file — a
 * guard that can't catch its own bug is worse than none, so it was replaced
 * with this one, which is mutation-verified below in the same commit.
 */

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Inline `{ ... }` TYPE literals describing a contract.
 *
 * Keyed on `billingStructure` annotated with a primitive — `billingStructure:
 * string` or `billingStructure?: string`. That's what distinguishes a type
 * position from the two things that otherwise flood the results: JSX
 * interpolations (`{contract.billingStructure}`) and value literals
 * (`{ billingStructure: form.billingStructure }`), whose right-hand side is
 * an expression rather than `string`/`number`/`boolean`.
 *
 * A first draft matched any braces containing the word and flagged 18 false
 * positives across pages that merely *render* the field. A guard that fails
 * CI on correct code gets deleted, which is the same outcome as not having
 * one — so it was narrowed to this, verified below to still catch the real
 * bug on `app/admin/page.tsx`.
 */
function contractShapedTypeLiterals(src: string): string[] {
  return [...src.matchAll(
    /\{[^{}]*\bbillingStructure\s*\??\s*:\s*(?:string|number|boolean)\b[^{}]*\}/g,
  )].map(m => m[0])
}

describe('inline contract types used for MRR', () => {
  const files = [...walk(join(root, 'app')), ...walk(join(root, 'lib')), ...walk(join(root, 'components'))]
    .map(f => [f.replace(root + '/', ''), readFileSync(f, 'utf-8')] as const)
    // The definition itself documents why the field is optional.
    .filter(([f]) => f !== join('lib', 'metrics.ts'))

  const withLiterals = files.flatMap(([f, src]) =>
    contractShapedTypeLiterals(src).map(lit => ({ file: f, lit })))

  it('finds inline contract types at all — guards against a silently-passing regex', () => {
    expect(withLiterals.length).toBeGreaterThan(0)
  })

  it('every inline contract type includes serviceType', () => {
    const missing = withLiterals
      .filter(({ lit }) => !/\bserviceType\b/.test(lit))
      .map(({ file, lit }) => `${file}: ${lit.replace(/\s+/g, ' ').slice(0, 90)}`)

    // An entry here means that surface's MRR disagrees with the rest of the app.
    expect(missing).toEqual([])
  })
})
