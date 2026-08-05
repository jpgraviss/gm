import { describe, it, expect } from 'vitest'
import { renewalBaseline, renewalQuote } from '@/lib/renewal-pricing'

// AUDIT #707 — RenewalProposalSidebar (app/renewals/page.tsx) generates a
// dollar figure a rep can quote to a real client. Two different kinds of
// value feed it and they are not interchangeable:
//   Contract.value    → per-billing-period (Annual 12000 = $1,000/mo)
//   Renewal.renewalValue → a TOTAL (LogRenewalModal: monthlyRate × months)

describe('renewalBaseline — linked contract path (AUDIT #128)', () => {
  it('uses the contract, normalized to a true monthly figure', () => {
    expect(renewalBaseline({ contract: { billingStructure: 'Monthly', value: 1000 }, renewalValue: 36000 }))
      .toEqual({ monthly: 1000, total: null, source: 'contract' })
  })

  it('normalizes Quarterly to monthly', () => {
    const b = renewalBaseline({ contract: { billingStructure: 'Quarterly', value: 3000 }, renewalValue: 36000 })
    expect(b.monthly).toBe(1000)
    expect(b.source).toBe('contract')
  })

  it('normalizes Annual to monthly — the $12,000/yr shown as $12,000/mo bug', () => {
    const b = renewalBaseline({ contract: { billingStructure: 'Annual', value: 12000 }, renewalValue: 12000 })
    expect(b.monthly).toBe(1000)
  })

  it('ignores the renewal total entirely when a contract is present', () => {
    const b = renewalBaseline({ contract: { billingStructure: 'Monthly', value: 500 }, renewalValue: 999999 })
    expect(b.monthly).toBe(500)
  })

  it('falls through to the renewal value for a non-recurring contract rather than quoting $0/mo', () => {
    // contractMonthlyValue() returns 0 for One-time / Milestone / Project.
    const b = renewalBaseline({ contract: { billingStructure: 'One-time', value: 25000 }, renewalValue: 36000 })
    expect(b.source).toBe('unknown-term')
    expect(b.monthly).toBeNull()
    expect(b.total).toBe(36000)
  })
})

describe('renewalBaseline — no linked contract (AUDIT #707, the default case)', () => {
  it('does NOT treat a multi-month total as a monthly rate', () => {
    // LogRenewalModal: $1,000/mo × 36 months → renewalValue 36000, contractId ''
    const b = renewalBaseline({ contract: null, renewalValue: 36000 })
    expect(b.monthly).toBeNull()
    expect(b.total).toBe(36000)
    expect(b.source).toBe('unknown-term')
  })

  it('derives a true monthly figure once the term is supplied', () => {
    const b = renewalBaseline({ contract: null, renewalValue: 36000, termMonths: 36 })
    expect(b).toEqual({ monthly: 1000, total: 36000, source: 'derived' })
  })

  it('derives correctly for a 12-month term', () => {
    expect(renewalBaseline({ contract: null, renewalValue: 18000, termMonths: 12 }).monthly).toBe(1500)
  })

  it('treats an undefined contract the same as a null one', () => {
    expect(renewalBaseline({ renewalValue: 24000 }).monthly).toBeNull()
    expect(renewalBaseline({ renewalValue: 24000, termMonths: 24 }).monthly).toBe(1000)
  })
})

describe('renewalBaseline — zero / missing / invalid term (no divide-by-zero)', () => {
  it('returns null monthly for a zero term instead of Infinity', () => {
    const b = renewalBaseline({ contract: null, renewalValue: 36000, termMonths: 0 })
    expect(b.monthly).toBeNull()
    expect(b.source).toBe('unknown-term')
  })

  for (const term of [null, undefined, NaN, Infinity, -12] as (number | null | undefined)[]) {
    it(`returns null monthly for a term of ${String(term)}`, () => {
      const b = renewalBaseline({ contract: null, renewalValue: 36000, termMonths: term })
      expect(b.monthly).toBeNull()
      expect(b.total).toBe(36000)
    })
  }

  it('coerces a missing/NaN renewal value to 0 rather than NaN', () => {
    expect(renewalBaseline({ renewalValue: null }).total).toBe(0)
    expect(renewalBaseline({ renewalValue: NaN, termMonths: 12 }).monthly).toBe(0)
  })

  it('handles a zero renewal value with a real term', () => {
    expect(renewalBaseline({ renewalValue: 0, termMonths: 12 }).monthly).toBe(0)
  })
})

describe('renewalQuote', () => {
  it('returns null when the monthly rate is unknown — callers must not quote a total', () => {
    expect(renewalQuote(null, 5, 12, 0)).toBeNull()
  })

  it('applies the increase and multiplies by the NEW term', () => {
    const q = renewalQuote(1000, 5, 12, 0)!
    expect(q.newMonthly).toBe(1050)
    expect(q.differencePerMonth).toBe(50)
    expect(q.newContractTotal).toBe(12600)
    expect(q.totalWithSetup).toBe(12600)
  })

  it('adds the setup fee to the total only', () => {
    const q = renewalQuote(1000, 0, 12, 2500)!
    expect(q.newMonthly).toBe(1000)
    expect(q.newContractTotal).toBe(12000)
    expect(q.totalWithSetup).toBe(14500)
  })

  it('quotes off the monthly rate, not the total — the 36x inflation regression', () => {
    // $1,000/mo × 36 months = $36,000 total, renewed for 12 months at +5%.
    const baseline = renewalBaseline({ contract: null, renewalValue: 36000, termMonths: 36 })
    const q = renewalQuote(baseline.monthly, 5, 12, 0)!
    expect(q.newMonthly).toBe(1050)
    expect(q.newContractTotal).toBe(12600)
    // The old code produced 36000 * 1.05 * 12 = $453,600.
    expect(q.newContractTotal).not.toBe(453600)
  })

  it('reports a negative change for a rate decrease', () => {
    const q = renewalQuote(1000, 0, 6, 0)!
    expect(q.differencePerMonth).toBe(0)
    expect(renewalQuote(1000, -10, 6, 0)!.differencePerMonth).toBe(-100)
  })

  it('never produces NaN/Infinity from bad numeric inputs', () => {
    const q = renewalQuote(1000, NaN, NaN, NaN)!
    expect(q.newMonthly).toBe(1000)
    expect(q.newContractTotal).toBe(0)
    expect(q.totalWithSetup).toBe(0)
  })
})
