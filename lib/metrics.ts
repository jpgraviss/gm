/**
 * Shared financial metric helpers so MRR/ARR are computed the same way
 * everywhere (contracts, billing, finance, admin, reports).
 *
 * Contract `value` stores the per-billing-period amount, NOT the total contract
 * value — e.g. a Monthly contract with value 1200 is $1,200/month. So MRR must
 * normalize each contract's value to a monthly figure by its billing structure,
 * never divide by contract duration.
 */

import { serviceRevenueKind } from '@/lib/services'

export interface MrrContract {
  status?: string
  billingStructure?: string
  value?: number
  /**
   * Optional. When present, a one-time service (Website Build, Sales
   * Training, Sales Enablement) is excluded from MRR even if it's billed
   * monthly — that's a payment plan, not recurring revenue. Omit it and the
   * billing structure alone decides, which is the pre-existing behavior and
   * what historical callers that don't pass a service still get.
   */
  serviceType?: string | null
}

/** Contract statuses that represent live, billing revenue. */
export const RECURRING_STATUSES = ['Fully Executed', 'Active']

/**
 * Normalize a single contract's value to a monthly recurring figure.
 * - Monthly / Monthly Retainer / default → value (already monthly)
 * - Quarterly → value / 3
 * - Annual / Yearly → value / 12
 * - One-time / Milestone / Project → 0 (not recurring)
 * - Custom → 0 (manually billed on bespoke terms; see below)
 *
 * `Custom` used to return the full value, so a Custom contract counted toward
 * MRR/ARR on every dashboard while `lib/recurring-billing.ts` deliberately
 * never invoiced it — it showed as live recurring revenue and was never
 * billed. Resolved as manually-billed: it now contributes 0 here, matching
 * what the cron already did.
 */
export function contractMonthlyValue(c: MrrContract): number {
  const v = c.value ?? 0
  const s = (c.billingStructure ?? '').toLowerCase()
  if (s.includes('quarter')) return v / 3
  if (s.includes('annual') || s.includes('year')) return v / 12
  if (s.includes('one') || s.includes('milestone') || s.includes('project')) return 0
  if (s.includes('custom')) return 0
  return v
}

/**
 * Whether a contract represents genuine recurring revenue.
 *
 * Two independent things have to be true, and this is the distinction the
 * service catalog's recurring/one-time identifier exists to draw:
 *
 *   1. It bills on a repeating cadence (Monthly/Quarterly/Annual), and
 *   2. the service itself is ongoing work, not a one-time job.
 *
 * A $10,000 Website Build contracted as 12 monthly payments satisfies (1) but
 * not (2). It is correctly invoiced every month by the retainer cron — the
 * client agreed to pay that way — but it is a payment plan that ends, not run
 * rate. Counting it as MRR would overstate the agency's recurring revenue by
 * the size of every active payment plan, and make ARR (MRR x 12) wrong by
 * twelve times that.
 *
 * When the service is unrecognized (legacy free-text like 'Consulting'), the
 * billing structure alone decides — the same answer this returned before the
 * service dimension existed, so historical records aren't reclassified.
 */
export function isRecurringRevenue(c: MrrContract): boolean {
  if (contractMonthlyValue(c) <= 0) return false
  return serviceRevenueKind(c.serviceType) !== 'one-time'
}

/**
 * Monthly Recurring Revenue: sum of monthly-normalized values across all
 * executed/active recurring contracts.
 */
export function computeMRR(contracts: MrrContract[]): number {
  return contracts
    .filter(c => RECURRING_STATUSES.includes(c.status ?? ''))
    .filter(isRecurringRevenue)
    .reduce((sum, c) => sum + contractMonthlyValue(c), 0)
}

/**
 * The counterpart to MRR: this period's one-time contract revenue, kept
 * separate rather than blended into a single number. Covers both genuinely
 * one-time billing structures and payment plans on one-time services —
 * money that arrives once per job and shouldn't be read as run rate.
 */
export function computeOneTimeValue(contracts: MrrContract[]): number {
  return contracts
    .filter(c => RECURRING_STATUSES.includes(c.status ?? ''))
    .filter(c => !isRecurringRevenue(c))
    .reduce((sum, c) => sum + (c.value ?? 0), 0)
}

/** Annual Recurring Revenue = MRR × 12. */
export function computeARR(contracts: MrrContract[]): number {
  return computeMRR(contracts) * 12
}
