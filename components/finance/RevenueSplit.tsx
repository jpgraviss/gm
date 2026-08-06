'use client'

/**
 * The four revenue buckets, shown apart from each other (AUDIT #738/#739/#742).
 *
 * Extracted from app/finance/page.tsx so the display rules are testable
 * without mounting the whole Finance page (which fetches Mercury, the
 * dashboard and all contracts on mount). The rules are small but they carry
 * real meaning:
 *
 *  - Pass-through is NOT revenue. It's a client's ad spend or reimbursables
 *    moving through the agency, so it must never be summed with the other
 *    three or presented as if it were income.
 *  - A zero bucket is hidden rather than shown as "$0". An agency that
 *    doesn't do paid media shouldn't see an empty Pass-Through card
 *    implying a category it doesn't use.
 */

export interface RevenueSplitProps {
  /** One-time jobs: builds, onboarding, creative — includes payment plans. */
  oneTime: number
  /** Ad-hoc revenue: cancellation fees, hourly work. */
  other: number
  /** Billed to clients and remitted onward. Not agency revenue. */
  passThrough: number
  format: (n: number) => string
}

interface Bucket {
  label: string
  value: number
  color: string
  hint: string
}

export function RevenueSplit({ oneTime, other, passThrough, format }: RevenueSplitProps) {
  const buckets: Bucket[] = [
    { label: 'One-Time', value: oneTime, color: '#8b5cf6',
      hint: 'Builds, onboarding, creative — including payment plans, which end' },
    { label: 'Other', value: other, color: '#f59e0b',
      hint: 'Ad-hoc: cancellation fees, hourly work' },
    { label: 'Pass-Through', value: passThrough, color: '#64748b',
      hint: 'Billed to clients and remitted onward — not agency revenue' },
  ].filter(b => b.value > 0)

  if (buckets.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-3">
        Contracted value by kind
      </p>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}
      >
        {buckets.map(b => (
          <div key={b.label} title={b.hint} className="border-l-2 pl-3" style={{ borderColor: b.color }}>
            <p className="text-[11px] text-gray-500 font-medium">{b.label}</p>
            <p className="text-base font-bold text-gray-900">{format(b.value)}</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{b.hint}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
