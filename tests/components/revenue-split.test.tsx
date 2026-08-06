import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RevenueSplit } from '@/components/finance/RevenueSplit'

/**
 * FIRST COMPONENT-RENDER TEST IN THIS REPO — follow this shape for others.
 *
 * AUDIT #532 left six page-level fixes uncovered with the note that
 * backfilling them "would mean introducing a new test pattern rather than
 * following an established one". The infrastructure was already there and
 * unused: `vitest.config.ts` runs jsdom, its `include` glob already matches
 * `tests/**\/*.test.tsx`, `@testing-library/react` is a dependency, and
 * `tests/setup.ts` wires the jest-dom matchers. Only an example was missing.
 *
 * The pattern:
 *  - Test EXTRACTED presentational components, not whole `app/**\/page.tsx`
 *    routes. Those pages fetch on mount (Finance alone hits Mercury, the
 *    dashboard and every contract), so mounting one tests the mocking more
 *    than the component. Pulling the piece with real display rules into
 *    `components/` makes it both cleaner and testable — that refactor is
 *    part of the work, not a detour around it.
 *  - Call `cleanup()` in `afterEach`; this project doesn't enable RTL's
 *    auto-cleanup globally, so without it renders leak between cases and
 *    `getBy*` starts failing on duplicate matches.
 *  - Assert on user-visible text, not class names or internal structure.
 *
 * What's being protected here is a money-presentation rule: pass-through is
 * a client's ad spend moving through the agency, and showing it as revenue
 * overstated income by the entire media budget before #739.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

afterEach(cleanup)

describe('RevenueSplit', () => {
  it('shows each bucket with its own figure', () => {
    render(<RevenueSplit oneTime={12000} other={1500} passThrough={20600} format={fmt} />)

    expect(screen.getByText('One-Time')).toBeInTheDocument()
    expect(screen.getByText('$12,000')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(screen.getByText('$1,500')).toBeInTheDocument()
    expect(screen.getByText('Pass-Through')).toBeInTheDocument()
    expect(screen.getByText('$20,600')).toBeInTheDocument()
  })

  it('states plainly that pass-through is not revenue', () => {
    // The whole point of surfacing it separately. If this wording is ever
    // softened, someone will read a client's ad spend as agency income.
    render(<RevenueSplit oneTime={0} other={0} passThrough={20600} format={fmt} />)
    expect(screen.getByText(/not agency revenue/i)).toBeInTheDocument()
  })

  it('never sums the buckets into a single total', () => {
    // $12,000 + $1,500 + $20,600 = $34,100. That figure is meaningless —
    // it adds pass-through to revenue — so it must not appear anywhere.
    render(<RevenueSplit oneTime={12000} other={1500} passThrough={20600} format={fmt} />)
    expect(screen.queryByText('$34,100')).not.toBeInTheDocument()
  })

  it('hides a bucket at zero instead of showing "$0"', () => {
    // An agency with no paid media shouldn't be shown an empty
    // "Pass-Through $0" card implying a category it doesn't use.
    render(<RevenueSplit oneTime={12000} other={0} passThrough={0} format={fmt} />)

    expect(screen.getByText('One-Time')).toBeInTheDocument()
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
    expect(screen.queryByText('Pass-Through')).not.toBeInTheDocument()
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
  })

  it('renders nothing at all when every bucket is empty', () => {
    // A brand-new workspace with only retainers gets no empty panel.
    const { container } = render(<RevenueSplit oneTime={0} other={0} passThrough={0} format={fmt} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides a negative bucket rather than rendering a negative figure', () => {
    // Defensive: a credit note or refund could drive a bucket below zero,
    // and "-$500 of one-time revenue" is a worse thing to show a user than
    // nothing at all.
    render(<RevenueSplit oneTime={-500} other={1500} passThrough={0} format={fmt} />)
    expect(screen.queryByText('One-Time')).not.toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('explains the payment-plan case, which is why one-time is separate', () => {
    render(<RevenueSplit oneTime={12000} other={0} passThrough={0} format={fmt} />)
    expect(screen.getByText(/payment plans, which end/i)).toBeInTheDocument()
  })
})
