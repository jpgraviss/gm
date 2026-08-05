import { describe, it, expect } from 'vitest'
import { serviceRevenueKind } from '@/lib/services'
import {
  contractMonthlyValue,
  isRecurringRevenue,
  computeMRR,
  computeARR,
  computeOneTimeValue,
  computeOtherValue,
  computePassThroughValue,
  computeTotalRevenue,
  contractRevenueKind,
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
    expect(serviceRevenueKind('SEO Management')).toBe('recurring')
    expect(serviceRevenueKind('Website Management')).toBe('recurring')
    expect(serviceRevenueKind('Social Media Management')).toBe('recurring')
    expect(serviceRevenueKind('Advertising Management')).toBe('recurring')
    expect(serviceRevenueKind('Website Build')).toBe('one-time')
    expect(serviceRevenueKind('Onboarding and Setup Fee')).toBe('one-time')
    expect(serviceRevenueKind('Content and Creative')).toBe('one-time')
    expect(serviceRevenueKind('Sales Training')).toBe('other')
    expect(serviceRevenueKind('Cancellation')).toBe('other')
    expect(serviceRevenueKind('Hourly Services')).toBe('other')
  })

  it('classifies pass-through costs as pass-through, not revenue', () => {
    // Billed to the client and remitted onward. The agency's cut is the
    // separate 'Advertising Management' fee, not the spend.
    expect(serviceRevenueKind('Advertising Spend')).toBe('pass-through')
    expect(serviceRevenueKind('Client Reimbursable Expenses')).toBe('pass-through')
  })

  it("reclassifies the values 'Client Reimbursable Expenses' replaced", () => {
    // Travel Expense and Amazon Order were free-text values counted as
    // revenue; as aliases they now resolve to pass-through automatically,
    // with no data migration.
    expect(serviceRevenueKind('Travel Expense')).toBe('pass-through')
    expect(serviceRevenueKind('Amazon Order')).toBe('pass-through')
  })

  it('treats a fractional engagement as recurring — the retainer tiers are the point', () => {
    expect(serviceRevenueKind('Fractional CMO')).toBe('recurring')
    expect(serviceRevenueKind('Fractional Sales Lead / CRO')).toBe('recurring')
  })

  it('resolves aliases, so historical values classify like their modern name', () => {
    expect(serviceRevenueKind('SEO')).toBe('recurring')
    expect(serviceRevenueKind('GEO')).toBe('recurring')
    expect(serviceRevenueKind('SEO / AEO / GEO')).toBe('recurring')
    expect(serviceRevenueKind('Social Media')).toBe('recurring')
    expect(serviceRevenueKind('Website')).toBe('one-time')
  })

  it('returns null for an unrecognized service — unknown, not one-time', () => {
    // Legacy free-text. Returning 'one-time' here would silently reclassify
    // historical contracts out of MRR.
    expect(serviceRevenueKind('Branding')).toBeNull()
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
    expect(isRecurringRevenue(active({ serviceType: 'SEO Management' }))).toBe(true)
  })

  it('excludes a payment plan — a one-time job billed monthly', () => {
    // The heart of it: a $10k Website Build over 12 months bills monthly and
    // the cron correctly invoices it, but it ends. Counting it as MRR would
    // overstate run rate by the size of every active payment plan, and ARR
    // by twelve times that.
    expect(isRecurringRevenue(active({ value: 833, serviceType: 'Website Build' }))).toBe(false)
  })

  it('excludes a genuinely one-time contract', () => {
    expect(isRecurringRevenue(active({ billingStructure: 'One-time', serviceType: 'Website Build' }))).toBe(false)
  })

  it('excludes Custom regardless of service', () => {
    expect(isRecurringRevenue(active({ billingStructure: 'Custom', serviceType: 'SEO Management' }))).toBe(false)
  })

  it('falls back to the billing structure for an unrecognized service', () => {
    // Pre-existing behavior preserved: historical records aren't reclassified.
    expect(isRecurringRevenue(active({ serviceType: 'Branding' }))).toBe(true)
    expect(isRecurringRevenue(active({ serviceType: undefined }))).toBe(true)
  })
})

describe('revenue buckets', () => {
  const book = [
    active({ value: 700, serviceType: 'SEO Management' }),                    // retainer
    active({ value: 350, serviceType: 'Website Management' }),                // retainer
    active({ value: 1200, serviceType: 'Advertising Management' }),           // retainer
    active({ value: 833, serviceType: 'Website Build' }),                     // payment plan
    active({ value: 2500, billingStructure: 'One-time', serviceType: 'Onboarding and Setup Fee' }),
    active({ value: 10000, billingStructure: 'One-time', serviceType: 'Sales Training' }),   // other
    active({ value: 1500, billingStructure: 'One-time', serviceType: 'Cancellation' }),      // other
    active({ value: 20000, serviceType: 'Advertising Spend' }),               // pass-through
    active({ value: 600, billingStructure: 'One-time', serviceType: 'Travel Expense' }),     // pass-through
    { status: 'Draft', value: 99999, billingStructure: 'Monthly', serviceType: 'SEO Management' },
  ]

  it('counts only genuine retainers as run rate', () => {
    expect(computeMRR(book)).toBe(700 + 350 + 1200)
  })

  it('keeps ARR consistent with MRR', () => {
    expect(computeARR(book)).toBe(2250 * 12)
  })

  it('reports one-time jobs separately, including the payment plan', () => {
    expect(computeOneTimeValue(book)).toBe(833 + 2500)
  })

  it('reports ad-hoc revenue separately', () => {
    expect(computeOtherValue(book)).toBe(10000 + 1500)
  })

  it('keeps pass-through out of every revenue figure', () => {
    // The headline property: $20,600 of ad spend and reimbursables moves
    // through the agency and is not revenue in any bucket.
    expect(computePassThroughValue(book)).toBe(20000 + 600)
    expect(computeTotalRevenue(book)).toBe(2250 + 833 + 2500 + 10000 + 1500)
    // And it is genuinely excluded, not merely reported alongside: revenue
    // is short of the total billed by exactly the pass-through amount.
    const totalBilled = computeTotalRevenue(book) + computePassThroughValue(book)
    expect(totalBilled - computeTotalRevenue(book)).toBe(20600)
  })

  it('never double-counts: every live contract lands in exactly one bucket', () => {
    const live = book.filter(c => c.status === 'Fully Executed')
    const counts = live.reduce<Record<string, number>>((acc, c) => {
      const k = contractRevenueKind(c)
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(live.length)
  })
})
