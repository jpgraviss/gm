import { describe, it, expect, vi, beforeEach } from 'vitest'

// Phase 3 — the single largest day-to-day gap in Finance: nothing kept
// invoices flowing from active recurring contracts, so with ~30 real
// retainer clients every invoice had to be hand-created every period.
// These tests pin the properties that make an automated biller safe to run
// unattended on a 5-minute cron: idempotency, correct per-period amount,
// and never billing past a contract's end.

vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn() }))

import {
  periodMonths,
  isRecurringStructure,
  currentPeriodStart,
  generateRecurringInvoices,
} from '@/lib/recurring-billing'

describe('recurring-billing — billing structure helpers', () => {
  it('maps billing structures to the right period length', () => {
    expect(periodMonths('Monthly')).toBe(1)
    expect(periodMonths('Quarterly')).toBe(3)
    expect(periodMonths('Annual')).toBe(12)
  })

  it('treats one-time/milestone/project billing as NOT recurring', () => {
    // Billing these on a schedule would invoice a client repeatedly for
    // work they agreed to pay for once.
    expect(isRecurringStructure('One-time')).toBe(false)
    expect(isRecurringStructure('Milestone')).toBe(false)
    expect(isRecurringStructure('Project')).toBe(false)
    expect(isRecurringStructure('Custom')).toBe(false)
    expect(isRecurringStructure('')).toBe(false)
  })

  it('recognizes real recurring structures', () => {
    expect(isRecurringStructure('Monthly')).toBe(true)
    expect(isRecurringStructure('Quarterly')).toBe(true)
    expect(isRecurringStructure('Annual')).toBe(true)
  })
})

describe('recurring-billing — period boundaries', () => {
  it('anchors the period to the contract start date', () => {
    // Contract started Jan 15; on Mar 20 we are in the Mar 15 period.
    expect(currentPeriodStart('2026-01-15', 1, new Date('2026-03-20'))).toBe('2026-03-15')
  })

  it('does not advance before the anniversary day within a period', () => {
    // On Mar 10 the Mar 15 period has not started yet — still Feb 15.
    expect(currentPeriodStart('2026-01-15', 1, new Date('2026-03-10'))).toBe('2026-02-15')
  })

  it('respects a quarterly cadence', () => {
    expect(currentPeriodStart('2026-01-01', 3, new Date('2026-05-02'))).toBe('2026-04-01')
  })

  it('returns null for a contract that has not started yet', () => {
    expect(currentPeriodStart('2027-01-01', 1, new Date('2026-06-01'))).toBeNull()
  })

  it('never returns a period start in the future for a month-end contract', () => {
    // The bug this pins: Date.setMonth() overflows Jan 31 to Mar 3, so the
    // computed period start landed AFTER today. The idempotency check
    // (`issued_date >= periodStart`) could then never match, and the cron
    // minted a fresh invoice every 5 minutes for days.
    for (const start of ['2026-01-31', '2026-01-30', '2025-08-31']) {
      const now = new Date('2026-03-01T12:00:00Z')
      const result = currentPeriodStart(start, 1, now)!
      expect(result <= '2026-03-01').toBe(true)
    }
  })

  it('clamps a month-end anniversary into a short month', () => {
    // Jan 31 + 1 month is Feb 28, not Mar 3.
    expect(currentPeriodStart('2026-01-31', 1, new Date('2026-02-28T12:00:00Z'))).toBe('2026-02-28')
  })
})

// ── Integration-style: the real generator against a mocked DB ───────────

interface Row { [k: string]: unknown }

function makeDb(opts: {
  contracts?: Row[]
  maintenance?: Row[]
  /** Simulate the invoices primary key already holding this period's row. */
  duplicateInvoiceId?: boolean
  /** Simulate another concurrent run having already claimed the billing date. */
  claimLost?: boolean
}) {
  const inserted: Record<string, Row[]> = {}
  const updated: Row[] = []

  const db = {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn(() => chain)
      chain.gte = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      chain.insert = vi.fn((payload: Row) => {
        if (table === 'invoices' && opts.duplicateInvoiceId) {
          // Postgres unique_violation on the invoices primary key — the
          // expected outcome on every cron tick after the first.
          return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
        }
        inserted[table] = inserted[table] ?? []
        inserted[table].push(payload)
        return Promise.resolve({ data: payload, error: null })
      })
      chain.update = vi.fn((payload: Row) => {
        updated.push(payload)
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn(() => upd)
        upd.select = vi.fn(() => upd)
        // The maintenance atomic claim: `data` non-null means this run won.
        upd.maybeSingle = vi.fn(() =>
          Promise.resolve({ data: opts.claimLost ? null : { id: 'm-1' }, error: null }))
        upd.then = (res: (v: unknown) => void) => Promise.resolve({ error: null }).then(res)
        return upd
      })
      // Awaiting the base query (the contracts/maintenance list reads).
      chain.then = (res: (v: unknown) => void) => {
        const data = table === 'contracts' ? (opts.contracts ?? [])
          : table === 'maintenance_records' ? (opts.maintenance ?? [])
          : []
        return Promise.resolve({ data, error: null }).then(res)
      }
      return chain
    }),
  }
  return { db, inserted, updated }
}

const MONTHLY_CONTRACT: Row = {
  id: 'c-1', company: 'Acme Co', company_id: 'comp-1',
  value: 2500, billing_structure: 'Monthly',
  start_date: '2026-01-15', renewal_date: '2027-01-15',
  service_type: 'SEO Management', status: 'Fully Executed',
}

describe('recurring-billing — generateRecurringInvoices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates an invoice for a due recurring contract', async () => {
    const { db, inserted } = makeDb({ contracts: [MONTHLY_CONTRACT] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(1)
    expect(inserted['invoices'][0]).toEqual(
      expect.objectContaining({
        company: 'Acme Co',
        company_id: 'comp-1',
        contract_id: 'c-1',
        amount: 2500,
        status: 'Pending',
        source: 'recurring',
      }),
    )
  })

  it('derives a deterministic invoice id from the contract and period', async () => {
    // This id IS the idempotency mechanism: a second attempt for the same
    // period collides with the invoices primary key. A check-then-insert
    // would not survive the overlapping cron runs the GitHub pinger causes
    // (--max-time 30 --retry 3 against a maxDuration=300 handler).
    const { db, inserted } = makeDb({ contracts: [MONTHLY_CONTRACT] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRecurringInvoices(db as any, new Date('2026-03-20'))
    expect(inserted['invoices'][0].id).toBe('inv-rec-c-1-2026-03-15')
  })

  it('treats a duplicate-key rejection as "already billed", not an error', async () => {
    const { db, inserted } = makeDb({
      contracts: [MONTHLY_CONTRACT],
      duplicateInvoiceId: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(0)
    expect(res.skipped).toBe(1)
    expect(res.errors).toBe(0)
    expect(inserted['invoices']).toBeUndefined()
  })

  it('bills an Annual contract its full annual value, once per year', async () => {
    // `contracts.value` is the per-BILLING-PERIOD amount (lib/metrics.ts), and
    // an Annual contract is invoiced once per 12 months — so $12,000/yr must
    // raise one $12,000 invoice. An earlier version ran the value through
    // contractMonthlyValue() (the MRR normalization) and raised $1,000
    // instead, under-billing the client 12x for the year.
    const { db, inserted } = makeDb({
      contracts: [{ ...MONTHLY_CONTRACT, billing_structure: 'Annual', value: 12_000 }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(inserted['invoices'][0].amount).toBe(12_000)
  })

  it('bills a Quarterly contract its full quarterly value', async () => {
    const { db, inserted } = makeDb({
      contracts: [{ ...MONTHLY_CONTRACT, billing_structure: 'Quarterly', value: 9_000 }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(inserted['invoices'][0].amount).toBe(9_000)
  })

  it('never bills a one-time contract', async () => {
    const { db, inserted } = makeDb({
      contracts: [{ ...MONTHLY_CONTRACT, billing_structure: 'One-time' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(0)
    expect(inserted['invoices']).toBeUndefined()
  })

  it('stops billing once the contract term has ended', async () => {
    const { db, inserted } = makeDb({
      contracts: [{ ...MONTHLY_CONTRACT, renewal_date: '2026-02-01' }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-06-01'))

    expect(res.invoicesCreated).toBe(0)
    expect(inserted['invoices']).toBeUndefined()
  })

  it('never bills a zero-value contract', async () => {
    const { db } = makeDb({ contracts: [{ ...MONTHLY_CONTRACT, value: 0 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))
    expect(res.invoicesCreated).toBe(0)
  })

  it('bills a due maintenance record and advances its schedule', async () => {
    const { db, inserted, updated } = makeDb({
      maintenance: [{
        id: 'm-1', company: 'Acme Co', company_id: 'comp-1', contract_id: 'c-1',
        monthly_fee: 800, next_billing_date: '2026-03-01',
        service_type: 'Website Management', status: 'Active', end_date: null,
      }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(1)
    expect(inserted['invoices'][0]).toEqual(
      expect.objectContaining({ amount: 800, contract_id: 'c-1', source: 'recurring' }),
    )
    // Schedule advanced by exactly one month — and the claim is written
    // BEFORE the invoice, so a losing concurrent run never inserts at all.
    expect(updated[0]).toEqual({ next_billing_date: '2026-04-01' })
  })

  it('does not invoice when another concurrent run already claimed the date', async () => {
    // The claim runs first precisely so the loser skips. The previous order
    // (insert, then claim) had both runs insert an $800 invoice and quietly
    // discarded only the losing claim.
    const { db, inserted } = makeDb({
      claimLost: true,
      maintenance: [{
        id: 'm-1', company: 'Acme Co', monthly_fee: 800,
        next_billing_date: '2026-03-01', status: 'Active',
      }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(0)
    expect(inserted['invoices']).toBeUndefined()
  })

  it('advances a month-end maintenance schedule without skipping February', async () => {
    // Plain Date.setMonth() turns Jan 31 into Mar 3 — February would never
    // be invoiced ($800 permanently lost) and the billing date would drift
    // off the 31st forever.
    const { db, updated } = makeDb({
      maintenance: [{
        id: 'm-1', company: 'Acme Co', monthly_fee: 800,
        next_billing_date: '2026-01-31', status: 'Active',
      }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRecurringInvoices(db as any, new Date('2026-02-05'))

    expect(updated[0]).toEqual({ next_billing_date: '2026-02-28' })
  })

  it('does not bill a maintenance record before its next billing date', async () => {
    const { db, inserted } = makeDb({
      maintenance: [{
        id: 'm-1', company: 'Acme Co', monthly_fee: 800,
        next_billing_date: '2026-05-01', status: 'Active',
      }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(0)
    expect(inserted['invoices']).toBeUndefined()
  })
})
