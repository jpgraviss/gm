import { describe, it, expect, vi, beforeEach } from 'vitest'

// Phase 1.1 — before this action existed there was NO way, not even via a
// hand-built automation, to create an invoice from an automation. That made
// Contract → Invoice the single biggest cross-module wiring gap in the app,
// and left `contract_id` null on literally every invoice in production
// (see app/contracts/page.tsx's own comment to that effect).

function createSupabaseChain(defaultResult = { data: null, error: null }) {
  const state = { _result: defaultResult as { data: unknown; error: unknown } }
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single', 'maybeSingle']) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(state._result).then(resolve, reject)
  chain._state = state
  return chain
}

let automationsResult: { data: unknown; error: unknown }
let contractResult: { data: unknown; error: unknown }
const insertCalls: Record<string, Record<string, unknown>[]> = {}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'automations') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = automationsResult
      return chain
    }
    if (table === 'contracts') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = contractResult
      return chain
    }
    const chain = createSupabaseChain()
    const origInsert = chain.insert as (d: unknown) => unknown
    chain.insert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
      insertCalls[table] = insertCalls[table] ?? []
      insertCalls[table].push(data)
      return origInsert(data)
    })
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))

import { fireAutomations } from '@/lib/automations-engine'

const flush = () => new Promise(r => setTimeout(r, 50))

function setupAutomation(trigger: string, config: Record<string, unknown> = {}) {
  automationsResult = {
    data: [{
      id: 'auto-inv',
      name: 'Bill on contract execution',
      trigger,
      actions: [{ type: 'Create Invoice', config }],
      status: 'Active',
      config: {},
    }],
    error: null,
  }
}

describe('automations-engine — Create Invoice action (Phase 1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    automationsResult = { data: [], error: null }
    contractResult = { data: null, error: null }
    for (const k of Object.keys(insertCalls)) delete insertCalls[k]
  })

  it('creates a real invoice from an explicit config amount', async () => {
    setupAutomation('Contract Fully Executed', { amount: 2500, serviceType: 'SEO / AEO / GEO' })
    fireAutomations('contract_executed', { company: 'Acme Co', companyId: 'comp-1' })
    await flush()

    expect(insertCalls['invoices']).toBeDefined()
    expect(insertCalls['invoices'][0]).toEqual(
      expect.objectContaining({
        company: 'Acme Co',
        company_id: 'comp-1',
        amount: 2500,
        status: 'Pending',
        service_type: 'SEO / AEO / GEO',
        source: 'automation',
      }),
    )
  })

  it('sets contract_id — the field every pre-existing invoice path left null', async () => {
    contractResult = {
      data: { company: 'Acme Co', company_id: 'comp-1', value: 1200, service_type: 'Website Build', billing_structure: 'Monthly' },
      error: null,
    }
    setupAutomation('Contract Fully Executed')
    fireAutomations('contract_executed', { company: 'Acme Co', companyId: 'comp-1', contractId: 'c-99' })
    await flush()

    expect(insertCalls['invoices'][0]).toEqual(
      expect.objectContaining({ contract_id: 'c-99', amount: 1200, service_type: 'Website Build' }),
    )
  })

  it('normalizes an Annual contract to its per-period amount, not the full year', async () => {
    // Billing an Annual contract's whole value every period would be a
    // serious overcharge — contractMonthlyValue exists precisely for this.
    contractResult = {
      data: { company: 'Acme Co', company_id: 'comp-1', value: 12_000, service_type: 'Retainer', billing_structure: 'Annual' },
      error: null,
    }
    setupAutomation('Contract Fully Executed')
    fireAutomations('contract_executed', { company: 'Acme Co', contractId: 'c-annual' })
    await flush()

    expect(insertCalls['invoices'][0].amount).toBe(1000)
  })

  it('skips entirely rather than creating a $0 invoice when no amount resolves', async () => {
    setupAutomation('Contract Fully Executed')
    fireAutomations('contract_executed', { company: 'Acme Co', companyId: 'comp-1' })
    await flush()

    expect(insertCalls['invoices']).toBeUndefined()
  })

  it('honors a custom due-date offset', async () => {
    setupAutomation('Contract Fully Executed', { amount: 500, dueDays: 7 })
    fireAutomations('contract_executed', { company: 'Acme Co' })
    await flush()

    const due = new Date(String(insertCalls['invoices'][0].due_date))
    const daysOut = Math.round((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    expect(daysOut).toBe(7)
  })
})
