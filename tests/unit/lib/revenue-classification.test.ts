import { describe, it, expect } from 'vitest'
import { serviceRevenueKind } from '@/lib/services'
import {
  contractMonthlyValue,
  isRecurringRevenue,
  computeMRR,
  computeARR,
  computeOneTimeValue,
} from '@/lib/metrics'

/**
 * Recurring vs one-time is the identifier that keeps the two revenue streams
 * accounted for separately. Two things used to be conflated:
 *
 *  - `Custom` counted toward MRR on every dashboard while the retainer cron
 *    deliberately never invoiced it — live recurring revenue that was never
 *    billed (AUDIT #732).
 *  - A one-time job on a payment plan (a $10k Website Build over 12 months)
 *    looked identical to a $10k/mo retainer, because only the contract's
 *    billing structure was consulted and never the service.
 */

const active = (over: Partial<Parameters<typeof isRecurringRevenue>[0]> = {}) => ({
  status: 'Fully Executed', value: 1000, billingStructure: 'Monthly', ...over,
})

describe('serviceRevenueKind', () => {
  it('classifies the catalog correctly', () => {
    expect(serviceRevenueKind('SEO / AEO / GEO')).toBe('recurring')
    expect(serviceRevenueKind('Website Management')).toBe('recurring')
    expect(serviceRevenueKind('Social Media')).toBe('recurring')
    expect(serviceRevenueKind('Website Build')).toBe('one-time')
    expect(serviceRevenueKind('Sales Training')).toBe('one-time')
    expect(serviceRevenueKind('Sales Enablement')).toBe('one-time')
  })

  it('treats a fractional engagement as recurring — the retainer tiers are the point', () => {
    expect(serviceRevenueKind('Fractional CMO')).toBe('recurring')
    expect(serviceRevenueKind('Fractional Sales Lead / CRO')).toBe('recurring')
  })

  it('resolves aliases, so historical values classify like their modern name', () => {
    expect(serviceRevenueKind('SEO')).toBe('recurring')
    expect(serviceRevenueKind('GEO')).toBe('recurring')
    expect(serviceRevenueKind('Website')).toBe('one-time')
  })

  it('returns null for an unrecognized service — unknown, not one-time', () => {
    // Legacy free-text. Returning 'one-time' here would silently reclassify
    // historical contracts out of MRR.
    expect(serviceRevenueKind('Consulting')).toBeNull()
    expect(serviceRevenueKind('')).toBeNull()
    expect(serviceRevenueKind(null)).toBeNull()
  })
})

describe('contractMonthlyValue — Custom (AUDIT #732)', () => {
  it('no longer counts a Custom contract as recurring revenue', () => {
    // It counted the full value here while recurring-billing never invoiced
    // it, so it showed as live MRR and was never billed.
    expect(contractMonthlyValue({ value: 5000, billingStructure: 'Custom' })).toBe(0)
  })

  it('leaves the real cadences alone', () => {
    expect(contractMonthlyValue({ value: 1200, billingStructure: 'Monthly' })).toBe(1200)
    expect(contractMonthlyValue({ value: 9000, billingStructure: 'Quarterly' })).toBe(3000)
    expect(contractMonthlyValue({ value: 12000, billingStructure: 'Annual' })).toBe(1000)
    expect(contractMonthlyValue({ value: 10000, billingStructure: 'One-time' })).toBe(0)
  })
})

describe('isRecurringRevenue', () => {
  it('counts a retainer on a recurring service', () => {
    expect(isRecurringRevenue(active({ serviceType: 'SEO / AEO / GEO' }))).toBe(true)
  })

  it('excludes a payment plan — a one-time job billed monthly', () => {
    // The heart of it: a $10k Website Build over 12 months bills monthly and
    // the cron correctly invoices it, but it ends. Counting it as MRR would
    // overstate run rate by the size of every active payment plan, and ARR
    // by twelve times that.
    expect(isRecurringRevenue(active({ value: 833, serviceType: 'Website Build' }))).toBe(false)
  })

  it('excludes a genuinely one-time contract', () => {
    expect(isRecurringRevenue(active({ billingStructure: 'One-time', serviceType: 'Sales Training' }))).toBe(false)
  })

  it('excludes Custom regardless of service', () => {
    expect(isRecurringRevenue(active({ billingStructure: 'Custom', serviceType: 'SEO / AEO / GEO' }))).toBe(false)
  })

  it('falls back to the billing structure for an unrecognized service', () => {
    // Pre-existing behavior preserved: historical records aren't reclassified.
    expect(isRecurringRevenue(active({ serviceType: 'Consulting' }))).toBe(true)
    expect(isRecurringRevenue(active({ serviceType: undefined }))).toBe(true)
  })
})

describe('computeMRR / computeOneTimeValue', () => {
  const book = [
    active({ value: 700, serviceType: 'SEO / AEO / GEO' }),                        // retainer
    active({ value: 350, serviceType: 'Website Management' }),                     // retainer
    active({ value: 833, serviceType: 'Website Build' }),                          // payment plan
    active({ value: 10000, billingStructure: 'One-time', serviceType: 'Sales Training' }),
    active({ value: 5000, billingStructure: 'Custom', serviceType: 'Sales Coaching' }),
    { status: 'Draft', value: 99999, billingStructure: 'Monthly', serviceType: 'SEO / AEO / GEO' },
  ]

  it('counts only genuine retainers on live contracts', () => {
    expect(computeMRR(book)).toBe(1050)
  })

  it('keeps ARR consistent with the narrower MRR', () => {
    expect(computeARR(book)).toBe(12600)
  })

  it('reports the one-time side separately rather than dropping it', () => {
    // The payment plan, the one-time sprint and the manually-billed Custom
    // contract are all real revenue — just not run rate.
    expect(computeOneTimeValue(book)).toBe(833 + 10000 + 5000)
  })

  it('never double-counts: every live contract lands in exactly one bucket', () => {
    const live = book.filter(c => c.status === 'Fully Executed')
    const recurring = live.filter(isRecurringRevenue).length
    const oneTime = live.filter(c => !isRecurringRevenue(c)).length
    expect(recurring + oneTime).toBe(live.length)
  })
})
