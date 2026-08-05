import { computeLineItemsBreakdown } from './deal-line-items'
import type { Deal, DealLineItem } from './types'

/**
 * Pure aggregation helpers for reporting on deals now that a deal can carry
 * multiple line items (see lib/deal-line-items.ts). Kept out of the page
 * components so the math is unit-testable and shared by every surface that
 * reports on deal value.
 *
 * The shared rule across every function here: a deal WITH line items is
 * reported from those line items; a deal WITHOUT them (created before the
 * feature existed) keeps its historical interpretation — the whole `value`
 * as a single one-time amount on its single `serviceType` — so old numbers
 * are never silently restated.
 */

/** Minimum shape needed to report on a deal; `Deal` satisfies it. */
export type ReportableDeal = Pick<Deal, 'value'> & {
  serviceType?: string
  lineItems?: DealLineItem[]
}

export interface BillingSplit {
  oneTime: number
  recurring: number
  total: number
}

/**
 * Split one deal's value into one-time vs. recurring money.
 *
 * Legacy deals (no line items) are treated as 100% one-time — that is
 * explicitly how those deals were always entered, not an accident of the
 * data shape.
 *
 * `total` always equals `deal.value`, so a split rendered under a headline
 * total computed as `sum(deal.value)` always reconciles with it. Line-item
 * amounts should already sum to `value` (the server derives it that way),
 * but if they ever drift the residual is booked as one-time rather than
 * silently dropped.
 */
export function computeDealBillingSplit(deal: ReportableDeal): BillingSplit {
  const items = deal.lineItems ?? []
  if (items.length === 0) {
    return { oneTime: deal.value, recurring: 0, total: deal.value }
  }
  const { oneTime, recurring } = computeLineItemsBreakdown(items)
  const residual = deal.value - (oneTime + recurring)
  return { oneTime: oneTime + residual, recurring, total: deal.value }
}

/** Sum `computeDealBillingSplit` across a list of deals. */
export function computeDealsBillingSplit(deals: ReportableDeal[]): BillingSplit {
  return deals.reduce<BillingSplit>(
    (acc, deal) => {
      const split = computeDealBillingSplit(deal)
      return {
        oneTime: acc.oneTime + split.oneTime,
        recurring: acc.recurring + split.recurring,
        total: acc.total + split.total,
      }
    },
    { oneTime: 0, recurring: 0, total: 0 },
  )
}

export interface ServiceRevenueEntry {
  service: string
  revenue: number
  /** Number of deals contributing revenue to this service line. A deal
   *  spanning two services counts once against each. */
  deals: number
}

/**
 * Revenue attributed per service line, sorted by revenue descending.
 *
 * AUDIT #719 — two deliberate paths:
 *   1. Deal HAS line items → its value is split across services by each
 *      line item's own `amount` (several items of the same service in one
 *      deal sum together, and the deal counts once toward that service).
 *      Previously the deal's entire value was credited to its single
 *      `serviceType` — whichever service happened to be added first — so a
 *      "$25.5K SEO + $57K Web Design" deal showed $82.5K on one line and
 *      $0 on the other.
 *   2. Deal has NO line items → unchanged legacy behavior: the whole
 *      `value` lands on its single `serviceType`, so historical data is
 *      not silently restated.
 */
export function aggregateServiceRevenue(deals: ReportableDeal[]): ServiceRevenueEntry[] {
  const svcMap = new Map<string, { revenue: number; deals: number }>()

  function credit(service: string, revenue: number, countsAsDeal: boolean) {
    const entry = svcMap.get(service) ?? { revenue: 0, deals: 0 }
    entry.revenue += revenue
    if (countsAsDeal) entry.deals++
    svcMap.set(service, entry)
  }

  for (const deal of deals) {
    const items = deal.lineItems ?? []
    if (items.length === 0) {
      credit(deal.serviceType ?? 'General', deal.value, true)
      continue
    }
    const perService = new Map<string, number>()
    for (const item of items) {
      const service = item.serviceType ?? 'General'
      perService.set(service, (perService.get(service) ?? 0) + item.amount)
    }
    for (const [service, revenue] of perService) {
      credit(service, revenue, true)
    }
  }

  return Array.from(svcMap, ([service, data]) => ({
    service,
    revenue: data.revenue,
    deals: data.deals,
  })).sort((a, b) => b.revenue - a.revenue)
}
