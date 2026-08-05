import { describe, it, expect } from 'vitest'
import {
  normalizeDealLineItems,
  computeLineItemsTotal,
  computeLineItemsBreakdown,
  serviceTypesFromLineItems,
} from '@/lib/deal-line-items'

// AUDIT #720 — the deal line-items feature shipped with zero test coverage.
// These pin the normalization guarantees the API routes depend on: a raw
// caller must not be able to corrupt a deal's value through a crafted line
// item, and the client-side editor must compute exactly what the server
// computes (they share these helpers precisely so they can't drift).

describe('normalizeDealLineItems', () => {
  it('returns an empty array for non-array input', () => {
    expect(normalizeDealLineItems(undefined)).toEqual([])
    expect(normalizeDealLineItems(null)).toEqual([])
    expect(normalizeDealLineItems('nope')).toEqual([])
    expect(normalizeDealLineItems({ amount: 5 })).toEqual([])
  })

  it('drops non-object entries rather than throwing', () => {
    expect(normalizeDealLineItems([null, 'x', 42])).toEqual([])
  })

  it('clamps a negative amount to zero', () => {
    // A negative line item would otherwise reduce a deal's total, letting a
    // crafted payload understate real pipeline value.
    const [item] = normalizeDealLineItems([{ serviceType: 'SEO / AEO / GEO', amount: -5000 }])
    expect(item.amount).toBe(0)
  })

  it('rejects non-finite amounts instead of propagating Infinity', () => {
    // Number("Infinity") is truthy so `|| 0` never caught it; an Infinity
    // reaching deals.value (numeric NOT NULL) serializes to null and blows
    // up as an opaque 500 rather than a clear validation error.
    expect(normalizeDealLineItems([{ amount: 'Infinity' }])[0].amount).toBe(0)
    expect(normalizeDealLineItems([{ amount: '1e400' }])[0].amount).toBe(0)
    expect(normalizeDealLineItems([{ amount: NaN }])[0].amount).toBe(0)
  })

  it('caps an absurd amount at the same ceiling the API validates against', () => {
    expect(normalizeDealLineItems([{ amount: 999_999_999_999 }])[0].amount).toBe(100_000_000)
  })

  it('defaults billingType to one-time and only accepts the recurring literal', () => {
    expect(normalizeDealLineItems([{ amount: 1 }])[0].billingType).toBe('one-time')
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'RECURRING' }])[0].billingType).toBe('one-time')
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'recurring' }])[0].billingType).toBe('recurring')
  })

  it('only keeps termMonths on a recurring line, and only when positive', () => {
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'one-time', termMonths: 6 }])[0].termMonths).toBeUndefined()
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'recurring', termMonths: 6 }])[0].termMonths).toBe(6)
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'recurring', termMonths: 0 }])[0].termMonths).toBeUndefined()
    expect(normalizeDealLineItems([{ amount: 1, billingType: 'recurring', termMonths: -3 }])[0].termMonths).toBeUndefined()
  })

  it('falls back to a General service type rather than persisting an empty one', () => {
    expect(normalizeDealLineItems([{ amount: 1 }])[0].serviceType).toBe('General')
    expect(normalizeDealLineItems([{ amount: 1, serviceType: '' }])[0].serviceType).toBe('General')
  })

  it('generates an id when one is missing, and preserves a real one', () => {
    expect(normalizeDealLineItems([{ amount: 1 }])[0].id).toBeTruthy()
    expect(normalizeDealLineItems([{ amount: 1, id: 'li-real' }])[0].id).toBe('li-real')
  })

  it('builds a fresh object rather than spreading input (no prototype pollution surface)', () => {
    const [item] = normalizeDealLineItems([{ amount: 1, __proto__: { polluted: true }, extra: 'x' }])
    expect(Object.keys(item).sort()).toEqual(['amount', 'billingType', 'id', 'serviceType'])
  })
})

describe('computeLineItemsTotal / computeLineItemsBreakdown', () => {
  const items = normalizeDealLineItems([
    { serviceType: 'Sales Enablement', amount: 25_500, billingType: 'one-time' },
    { serviceType: 'SEO / AEO / GEO', amount: 57_000, billingType: 'recurring', termMonths: 6 },
  ])

  it('totals the real-world example the feature was built for', () => {
    // "$25.5K one-time + $57K recurring = $82.5K" — the user's own arithmetic.
    expect(computeLineItemsTotal(items)).toBe(82_500)
  })

  it('splits one-time from recurring and reconciles to the total', () => {
    const b = computeLineItemsBreakdown(items)
    expect(b.oneTime).toBe(25_500)
    expect(b.recurring).toBe(57_000)
    expect(b.total).toBe(b.oneTime + b.recurring)
  })

  it('handles an empty list without NaN', () => {
    expect(computeLineItemsTotal([])).toBe(0)
    expect(computeLineItemsBreakdown([])).toEqual({ oneTime: 0, recurring: 0, total: 0 })
  })
})

describe('serviceTypesFromLineItems', () => {
  it('de-duplicates while preserving first-seen order', () => {
    const items = normalizeDealLineItems([
      { serviceType: 'Website Build', amount: 1 },
      { serviceType: 'SEO / AEO / GEO', amount: 2 },
      { serviceType: 'Website Build', amount: 3 },
    ])
    expect(serviceTypesFromLineItems(items)).toEqual(['Website Build', 'SEO / AEO / GEO'])
  })

  it('returns an empty list for no items — the deals PATCH relies on this', () => {
    expect(serviceTypesFromLineItems([])).toEqual([])
  })
})
