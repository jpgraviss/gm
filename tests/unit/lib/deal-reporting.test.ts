import { describe, it, expect } from 'vitest'
import {
  aggregateServiceRevenue,
  computeDealBillingSplit,
  computeDealsBillingSplit,
  type ReportableDeal,
} from '@/lib/deal-reporting'
import type { DealLineItem } from '@/lib/types'

function item(partial: Partial<DealLineItem> & { amount: number }): DealLineItem {
  return {
    id: partial.id ?? `li-${Math.random().toString(36).slice(2)}`,
    serviceType: (partial.serviceType ?? 'SEO / AEO / GEO') as DealLineItem['serviceType'],
    billingType: partial.billingType ?? 'one-time',
    amount: partial.amount,
    ...(partial.termMonths !== undefined ? { termMonths: partial.termMonths } : {}),
  }
}

describe('computeDealBillingSplit', () => {
  it('splits a deal with mixed one-time and recurring line items', () => {
    const deal: ReportableDeal = {
      value: 87_000,
      serviceType: 'Website Build',
      lineItems: [
        item({ serviceType: 'Website Build', billingType: 'one-time', amount: 57_000 }),
        item({ serviceType: 'SEO / AEO / GEO', billingType: 'recurring', amount: 30_000, termMonths: 6 }),
      ],
    }
    expect(computeDealBillingSplit(deal)).toEqual({ oneTime: 57_000, recurring: 30_000, total: 87_000 })
  })

  it('treats a legacy deal with no line items as entirely one-time', () => {
    expect(computeDealBillingSplit({ value: 42_000, serviceType: 'Branding' }))
      .toEqual({ oneTime: 42_000, recurring: 0, total: 42_000 })
    expect(computeDealBillingSplit({ value: 42_000, serviceType: 'Branding', lineItems: [] }))
      .toEqual({ oneTime: 42_000, recurring: 0, total: 42_000 })
  })

  it('keeps total equal to deal.value, booking any line-item drift as one-time', () => {
    const deal: ReportableDeal = {
      value: 10_000,
      serviceType: 'SEO / AEO / GEO',
      lineItems: [item({ billingType: 'recurring', amount: 6_000 })],
    }
    expect(computeDealBillingSplit(deal)).toEqual({ oneTime: 4_000, recurring: 6_000, total: 10_000 })
  })
})

describe('computeDealsBillingSplit', () => {
  it('sums the split across a mix of line-item and legacy deals', () => {
    const deals: ReportableDeal[] = [
      {
        value: 62_000,
        serviceType: 'Website Build',
        lineItems: [
          item({ serviceType: 'Website Build', billingType: 'one-time', amount: 57_000 }),
          item({ serviceType: 'Maintenance', billingType: 'recurring', amount: 5_000, termMonths: 1 }),
        ],
      },
      { value: 12_000, serviceType: 'SEO / AEO / GEO' },
      {
        value: 9_000,
        serviceType: 'SEO / AEO / GEO',
        lineItems: [item({ serviceType: 'SEO / AEO / GEO', billingType: 'recurring', amount: 9_000, termMonths: 3 })],
      },
    ]
    expect(computeDealsBillingSplit(deals)).toEqual({ oneTime: 69_000, recurring: 14_000, total: 83_000 })
  })

  it('returns zeroes for an empty list', () => {
    expect(computeDealsBillingSplit([])).toEqual({ oneTime: 0, recurring: 0, total: 0 })
  })

  it('total matches a plain sum of deal.value (the headline KPI)', () => {
    const deals: ReportableDeal[] = [
      { value: 5_000, serviceType: 'SEO / AEO / GEO' },
      { value: 7_500, serviceType: 'PPC', lineItems: [item({ serviceType: 'PPC', amount: 7_500 })] },
    ]
    const split = computeDealsBillingSplit(deals)
    expect(split.total).toBe(deals.reduce((s, d) => s + d.value, 0))
    expect(split.oneTime + split.recurring).toBe(split.total)
  })
})

describe('aggregateServiceRevenue (AUDIT #719)', () => {
  it('splits a line-item deal across two services by each line item amount', () => {
    const deals: ReportableDeal[] = [{
      value: 82_500,
      serviceType: 'SEO / AEO / GEO',
      lineItems: [
        item({ serviceType: 'SEO / AEO / GEO', amount: 25_500 }),
        item({ serviceType: 'Website Build', amount: 57_000 }),
      ],
    }]
    expect(aggregateServiceRevenue(deals)).toEqual([
      { service: 'Website Build', revenue: 57_000, deals: 1 },
      { service: 'SEO / AEO / GEO', revenue: 25_500, deals: 1 },
    ])
  })

  it('sums multiple line items of the same service within one deal, counting the deal once', () => {
    const deals: ReportableDeal[] = [{
      value: 15_000,
      serviceType: 'SEO / AEO / GEO',
      lineItems: [
        item({ serviceType: 'SEO / AEO / GEO', billingType: 'one-time', amount: 4_000 }),
        item({ serviceType: 'SEO / AEO / GEO', billingType: 'recurring', amount: 6_000 }),
        item({ serviceType: 'PPC', amount: 5_000 }),
      ],
    }]
    expect(aggregateServiceRevenue(deals)).toEqual([
      { service: 'SEO / AEO / GEO', revenue: 10_000, deals: 1 },
      { service: 'PPC', revenue: 5_000, deals: 1 },
    ])
  })

  it('attributes a legacy deal with no line items entirely to its single serviceType', () => {
    expect(aggregateServiceRevenue([{ value: 30_000, serviceType: 'Branding' }]))
      .toEqual([{ service: 'Branding', revenue: 30_000, deals: 1 }])
    expect(aggregateServiceRevenue([{ value: 30_000, serviceType: 'Branding', lineItems: [] }]))
      .toEqual([{ service: 'Branding', revenue: 30_000, deals: 1 }])
  })

  it('aggregates a mix of line-item and legacy deals, sorted by revenue desc', () => {
    const deals: ReportableDeal[] = [
      {
        value: 82_500,
        serviceType: 'SEO / AEO / GEO',
        lineItems: [
          item({ serviceType: 'SEO / AEO / GEO', amount: 25_500 }),
          item({ serviceType: 'Website Build', amount: 57_000 }),
        ],
      },
      { value: 20_000, serviceType: 'SEO / AEO / GEO' },
      { value: 8_000, serviceType: 'Email Marketing' },
      {
        value: 12_000,
        serviceType: 'Website Build',
        lineItems: [item({ serviceType: 'Website Build', billingType: 'recurring', amount: 12_000, termMonths: 12 })],
      },
    ]
    expect(aggregateServiceRevenue(deals)).toEqual([
      { service: 'Website Build', revenue: 69_000, deals: 2 },
      { service: 'SEO / AEO / GEO', revenue: 45_500, deals: 2 },
      { service: 'Email Marketing', revenue: 8_000, deals: 1 },
    ])
  })

  it('preserves the grand total across every deal', () => {
    const deals: ReportableDeal[] = [
      {
        value: 82_500,
        serviceType: 'SEO / AEO / GEO',
        lineItems: [
          item({ serviceType: 'SEO / AEO / GEO', amount: 25_500 }),
          item({ serviceType: 'Website Build', amount: 57_000 }),
        ],
      },
      { value: 20_000, serviceType: 'SEO / AEO / GEO' },
    ]
    const total = aggregateServiceRevenue(deals).reduce((s, e) => s + e.revenue, 0)
    expect(total).toBe(102_500)
  })

  it('returns an empty list for no deals', () => {
    expect(aggregateServiceRevenue([])).toEqual([])
  })

  it('falls back to General when a deal has no serviceType at all', () => {
    expect(aggregateServiceRevenue([{ value: 1_000 }]))
      .toEqual([{ service: 'General', revenue: 1_000, deals: 1 }])
  })
})
