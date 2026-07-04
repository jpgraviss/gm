/**
 * Shared financial metric helpers so MRR/ARR are computed the same way
 * everywhere (contracts, billing, finance, admin, reports).
 *
 * Contract `value` stores the per-billing-period amount, NOT the total contract
 * value — e.g. a Monthly contract with value 1200 is $1,200/month. So MRR must
 * normalize each contract's value to a monthly figure by its billing structure,
 * never divide by contract duration.
 */

export interface MrrContract {
  status?: string
  billingStructure?: string
  value?: number
}

/** Contract statuses that represent live, billing revenue. */
export const RECURRING_STATUSES = ['Fully Executed', 'Active']

/**
 * Normalize a single contract's value to a monthly recurring figure.
 * - Monthly / Monthly Retainer / Custom / default → value (already monthly)
 * - Quarterly → value / 3
 * - Annual / Yearly → value / 12
 * - One-time / Milestone / Project → 0 (not recurring)
 */
export function contractMonthlyValue(c: MrrContract): number {
  const v = c.value ?? 0
  const s = (c.billingStructure ?? '').toLowerCase()
  if (s.includes('quarter')) return v / 3
  if (s.includes('annual') || s.includes('year')) return v / 12
  if (s.includes('one') || s.includes('milestone') || s.includes('project')) return 0
  return v
}

/**
 * Monthly Recurring Revenue: sum of monthly-normalized values across all
 * executed/active recurring contracts.
 */
export function computeMRR(contracts: MrrContract[]): number {
  return contracts
    .filter(c => RECURRING_STATUSES.includes(c.status ?? ''))
    .reduce((sum, c) => sum + contractMonthlyValue(c), 0)
}

/** Annual Recurring Revenue = MRR × 12. */
export function computeARR(contracts: MrrContract[]): number {
  return computeMRR(contracts) * 12
}
