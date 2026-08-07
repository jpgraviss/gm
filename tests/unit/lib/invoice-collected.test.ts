import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { collectedAmount } from '@/lib/invoice-collected'

/**
 * AUDIT #776 — `amount_paid ?? amount` counts hand-marked-Paid invoices as $0.
 *
 * `invoices.amount_paid` is `numeric not null default 0` and only the Stripe
 * webhook writes it, so an invoice marked Paid through the UI (cheque, ACH,
 * cash — the normal path for most agency payments) sits at `0`. Since `0` is
 * not nullish, `??` never falls back, and the invoice contributes nothing to
 * Revenue Collected while sitting in the Paid tab of the same screen.
 *
 * The behaviour test pins the rule; the call-site scan pins the fact that
 * nobody re-implements it, which is how the bug reached four places to begin
 * with.
 */

describe('collectedAmount', () => {
  it('uses the invoice amount when no payment was recorded', () => {
    // The regression: amount_paid at its schema default.
    expect(collectedAmount({ amount: 2000, amount_paid: 0 })).toBe(2000)
    expect(collectedAmount({ amount: 2000, amountPaid: 0 })).toBe(2000)
  })

  it('uses the recorded payment when Stripe charged a different amount', () => {
    // #358/#587 — the invoice was edited after payment; what was actually
    // charged is the truth.
    expect(collectedAmount({ amount: 2000, amount_paid: 1800 })).toBe(1800)
    expect(collectedAmount({ amount: 2000, amountPaid: 2500 })).toBe(2500)
  })

  it('falls back for null, undefined and unparseable values', () => {
    expect(collectedAmount({ amount: 500, amount_paid: null })).toBe(500)
    expect(collectedAmount({ amount: 500 })).toBe(500)
    expect(collectedAmount({ amount: '500', amount_paid: '' })).toBe(500)
  })

  it('never returns NaN', () => {
    expect(collectedAmount({})).toBe(0)
    expect(collectedAmount({ amount: null, amount_paid: undefined })).toBe(0)
    expect(collectedAmount({ amount: 'abc' })).toBe(0)
  })
})

const root = resolve(__dirname, '../../..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('no call site re-derives the collected amount (AUDIT #776)', () => {
  it('is the only place amount_paid falls back to amount', () => {
    const offenders: string[] = []
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of walk(join(root, dir))) {
        const rel = file.slice(root.length + 1)
        if (rel === 'lib/invoice-collected.ts') continue
        readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
          // Comments explain this exact expression at every repaired site.
          if (/^\s*(\/\/|\/?\*)/.test(line)) return
          // Only a fallback *to the invoice amount* is the bug. The API
          // mapper's `row.amount_paid ?? undefined` is a different thing and
          // is correct — it hands the raw column through, and
          // collectedAmount() is what decides whether a 0 means anything.
          if (/\bamount_?[Pp]aid\s*\?\?\s*[\w.]*\bamount\b/.test(line)) offenders.push(`${rel}:${i + 1}`)
        })
      }
    }
    expect(offenders, `use collectedAmount() instead:\n${offenders.join('\n')}`).toEqual([])
  })
})
