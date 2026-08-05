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
})

// ── Integration-style: the real generator against a mocked DB ───────────

interface Row { [k: string]: unknown }

function makeDb(opts: {
  contracts?: Row[]
  maintenance?: Row[]
  existingInvoice?: Row | null
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
      chain.maybeSingle = vi.fn(() =>
        Promise.resolve({ data: table === 'invoices' ? (opts.existingInvoice ?? null) : null, error: null }))
      chain.insert = vi.fn((payload: Row) => {
        inserted[table] = inserted[table] ?? []
        inserted[table].push(payload)
        return Promise.resolve({ data: payload, error: null })
      })
      chain.update = vi.fn((payload: Row) => {
        updated.push(payload)
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn(() => upd)
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
  service_type: 'SEO / AEO / GEO', status: 'Fully Executed',
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

  it('is idempotent — skips when this period was already invoiced', async () => {
    // The cron is pinged every 5 minutes; without this it would mint
    // duplicate invoices continuously all day.
    const { db, inserted } = makeDb({
      contracts: [MONTHLY_CONTRACT],
      existingInvoice: { id: 'inv-existing' },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(res.invoicesCreated).toBe(0)
    expect(res.skipped).toBe(1)
    expect(inserted['invoices']).toBeUndefined()
  })

  it('normalizes an Annual contract to its per-period amount', async () => {
    // Billing the full annual value every period would be a serious
    // overcharge — this is the same guard the Create Invoice action has.
    const { db, inserted } = makeDb({
      contracts: [{ ...MONTHLY_CONTRACT, billing_structure: 'Annual', value: 12_000 }],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await generateRecurringInvoices(db as any, new Date('2026-03-20'))

    expect(inserted['invoices'][0].amount).toBe(1000)
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
    // Schedule advanced by exactly one month.
    expect(updated[0]).toEqual({ next_billing_date: '2026-04-01' })
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
