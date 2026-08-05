/**
 * Renewal quoting math (app/renewals/page.tsx → RenewalProposalSidebar).
 *
 * AUDIT #707. Two different kinds of dollar figure feed the renewal proposal
 * builder, and they are NOT interchangeable:
 *
 *  1. `Contract.value` — a PER-BILLING-PERIOD amount. `contractMonthlyValue()`
 *     (lib/metrics.ts) normalizes Quarterly/Annual/etc. to a true monthly
 *     figure. This is the good path, fixed by AUDIT #128.
 *
 *  2. `Renewal.renewalValue` — a TOTAL contract value. The only real UI that
 *     creates renewals (LogRenewalModal) computes it as
 *     `costPerMonth * contractMonths` and its own preview even labels it
 *     "$X/mo × N months". That modal ALWAYS sends `contractId: ''`, so the
 *     no-linked-contract case is the DEFAULT, not an edge case.
 *
 * The sidebar used to fall back to `renewal.renewalValue` as if it were a
 * monthly rate, inflating "Current Monthly", "Current Annual" and the
 * generated "New Contract Total" by the term length (up to 36x) on a figure a
 * rep can quote to a real client.
 *
 * The term length is NOT recoverable from a renewal record: `app/api/renewals`
 * POST never persists the modal's `startDate`, and `public.renewals`
 * (supabase/schema.sql) has no start_date and no term/months column — only
 * `expiration_date`, `renewal_value` and `days_until_expiry`. So there is no
 * honest divisor to invent here. `renewalBaseline()` therefore reports
 * `monthly: null` and hands back the TOTAL instead, and the UI either labels
 * it as a total or asks the rep for the term that total covers.
 */

import { contractMonthlyValue, type MrrContract } from './metrics'

export type RenewalBaselineSource =
  /** Monthly rate normalized from a linked Contract record. */
  | 'contract'
  /** Monthly rate derived as (renewal total ÷ a known term in months). */
  | 'derived'
  /** Only a total is known — the term length isn't recorded anywhere. */
  | 'unknown-term'

export interface RenewalBaseline {
  /** True monthly rate, or null when it cannot be derived honestly. */
  monthly: number | null
  /** The renewal's total contract value, when that is all we hold. */
  total: number | null
  source: RenewalBaselineSource
}

export interface RenewalBaselineInput {
  /** Linked contract, if one was found for this renewal. */
  contract?: MrrContract | null
  /** `Renewal.renewalValue` — a TOTAL contract value, not a monthly rate. */
  renewalValue?: number | null
  /** Term in months the total covers, when the user supplies it. */
  termMonths?: number | null
}

function finite(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/**
 * Work out what the CURRENT monthly rate for a renewal actually is.
 *
 * A linked contract wins, because its value is billing-structure-relative and
 * `contractMonthlyValue()` knows how to normalize it. A contract whose billing
 * structure carries no recurring value at all (One-time / Milestone / Project
 * → 0) is not a usable monthly baseline, so it falls through to the renewal
 * total rather than quoting $0/mo.
 */
export function renewalBaseline({ contract, renewalValue, termMonths }: RenewalBaselineInput): RenewalBaseline {
  if (contract) {
    const monthly = contractMonthlyValue(contract)
    if (Number.isFinite(monthly) && monthly > 0) {
      return { monthly, total: null, source: 'contract' }
    }
  }

  const total = finite(renewalValue)
  const term = finite(termMonths)
  if (term > 0) {
    return { monthly: total / term, total, source: 'derived' }
  }

  // No contract and no term: `total` is a multi-month TOTAL and presenting it
  // as a monthly figure is exactly the bug this module exists to prevent.
  return { monthly: null, total, source: 'unknown-term' }
}

export interface RenewalQuote {
  /** Proposed monthly rate after the increase. */
  newMonthly: number
  /** Change vs. the current monthly rate. */
  differencePerMonth: number
  /** newMonthly × the new term, before any setup fee. */
  newContractTotal: number
  /** newContractTotal + setup fee. */
  totalWithSetup: number
}

/**
 * Build the numbers a rep can actually quote. Returns null when the current
 * monthly rate is unknown — the caller must NOT fall back to the renewal
 * total, which is what produced the inflated quote in the first place.
 */
export function renewalQuote(
  baseMonthly: number | null,
  increasePercent: number,
  months: number,
  setupFee: number,
): RenewalQuote | null {
  if (baseMonthly === null || !Number.isFinite(baseMonthly)) return null

  const pct = finite(increasePercent)
  const term = Math.max(0, finite(months))
  const fee = Math.max(0, finite(setupFee))

  const newMonthly = Math.round(baseMonthly * (1 + pct / 100))
  const newContractTotal = newMonthly * term
  return {
    newMonthly,
    differencePerMonth: newMonthly - baseMonthly,
    newContractTotal,
    totalWithSetup: newContractTotal + fee,
  }
}
