/**
 * Shared financial metric helpers so MRR/ARR are computed the same way
 * everywhere (contracts, billing, finance, admin, reports).
 *
 * Contract `value` stores the per-billing-period amount, NOT the total contract
 * value — e.g. a Monthly contract with value 1200 is $1,200/month. So MRR must
 * normalize each contract's value to a monthly figure by its billing structure,
 * never divide by contract duration.
 */

import { serviceRevenueKind, type RevenueKind } from '@/lib/services'

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
  return contractRevenueKind(c) === 'recurring' && contractMonthlyValue(c) > 0
}

/**
 * Which revenue bucket a contract belongs in. Every contract lands in exactly
 * one, so the four totals below sum to the whole book with no double-counting
 * and nothing silently dropped.
 *
 *   recurring     run rate — MRR/ARR
 *   one-time      a job that's billed once (or financed over a payment plan)
 *   other         real revenue billed ad hoc: training, cancellation, hourly
 *   pass-through  NOT revenue — billed to the client and remitted onward
 *
 * The service decides when the catalog recognizes it. When it doesn't
 * (legacy free-text), the billing structure alone decides, which is what this
 * returned before the service dimension existed — historical records are
 * never silently reclassified.
 */
export function contractRevenueKind(c: MrrContract): Exclude<RevenueKind, never> {
  const fromService = serviceRevenueKind(c.serviceType)
  if (fromService) return fromService
  return contractMonthlyValue(c) > 0 ? 'recurring' : 'one-time'
}

/** Sum of a bucket. Uses the monthly-normalized figure for run rate and the
 *  contract's own value for everything else, which is billed as a lump. */
function sumKind(contracts: MrrContract[], kind: RevenueKind): number {
  return contracts
    .filter(c => RECURRING_STATUSES.includes(c.status ?? ''))
    .filter(c => contractRevenueKind(c) === kind)
    .reduce((sum, c) => sum + (kind === 'recurring' ? contractMonthlyValue(c) : (c.value ?? 0)), 0)
}

/**
 * Monthly Recurring Revenue: sum of monthly-normalized values across all
 * executed/active recurring contracts.
 */
export function computeMRR(contracts: MrrContract[]): number {
  return sumKind(contracts, 'recurring')
}

/**
 * The counterpart to MRR: this period's one-time contract revenue, kept
 * separate rather than blended into a single number. Covers both genuinely
 * one-time billing structures and payment plans on one-time services —
 * money that arrives once per job and shouldn't be read as run rate.
 */
export function computeOneTimeValue(contracts: MrrContract[]): number {
  return sumKind(contracts, 'one-time')
}

/** Ad-hoc revenue: Sales Training, Cancellation fees, Hourly Services. */
export function computeOtherValue(contracts: MrrContract[]): number {
  return sumKind(contracts, 'other')
}

/**
 * Money billed to clients and remitted straight on to a third party —
 * Advertising Spend, Client Reimbursable Expenses. **Not agency revenue.**
 * Reported so the cash movement stays visible, and deliberately excluded from
 * MRR, one-time and other, so no revenue total can accidentally absorb it.
 * Billing $10,000 of ad spend alongside a $2,000 management fee is $2,000 of
 * revenue and $10,000 of pass-through, not $12,000 of anything.
 */
export function computePassThroughValue(contracts: MrrContract[]): number {
  return sumKind(contracts, 'pass-through')
}

/** Agency revenue proper: everything except pass-through. */
export function computeTotalRevenue(contracts: MrrContract[]): number {
  return computeMRR(contracts) + computeOneTimeValue(contracts) + computeOtherValue(contracts)
}

/** Annual Recurring Revenue = MRR × 12. */
export function computeARR(contracts: MrrContract[]): number {
  return computeMRR(contracts) * 12
}
