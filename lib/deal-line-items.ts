import type { DealLineItem } from './types'

/**
 * Shared helpers for the deal line-items model (see the DealLineItem doc
 * comment in lib/types.ts) so the client-side editor and both API routes
 * (app/api/deals/route.ts POST, app/api/deals/[id]/route.ts PATCH) compute
 * the same totals the same way.
 */

export function normalizeDealLineItems(raw: unknown): DealLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, i) => {
      const billingType: DealLineItem['billingType'] = item.billingType === 'recurring' ? 'recurring' : 'one-time'
      const amount = Math.max(0, Number(item.amount) || 0)
      const rawTerm = Number(item.termMonths)
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `li-${Date.now()}-${i}`,
        serviceType: (typeof item.serviceType === 'string' && item.serviceType ? item.serviceType : 'General') as DealLineItem['serviceType'],
        billingType,
        amount,
        ...(billingType === 'recurring' && Number.isFinite(rawTerm) && rawTerm > 0
          ? { termMonths: Math.round(rawTerm) }
          : {}),
      }
    })
}

export function computeLineItemsTotal(items: DealLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

export interface LineItemsBreakdown {
  oneTime: number
  recurring: number
  total: number
}

export function computeLineItemsBreakdown(items: DealLineItem[]): LineItemsBreakdown {
  const breakdown = items.reduce(
    (acc, item) => {
      if (item.billingType === 'recurring') acc.recurring += item.amount
      else acc.oneTime += item.amount
      return acc
    },
    { oneTime: 0, recurring: 0 },
  )
  return { ...breakdown, total: breakdown.oneTime + breakdown.recurring }
}

/** Distinct service types represented across a deal's line items, in the
 *  order first seen — used to derive `serviceTypes` when line items are
 *  the source of truth instead of a manually-picked list. */
export function serviceTypesFromLineItems(items: DealLineItem[]): string[] {
  return Array.from(new Set(items.map(item => item.serviceType)))
}
