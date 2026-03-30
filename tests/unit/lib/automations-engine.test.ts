import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a chainable mock that supports Supabase's fluent API.
// Every method returns the same chain object, and the chain is also "thenable"
// so it can be awaited. The resolved value is controlled via `_result`.
function createSupabaseChain(defaultResult = { data: null, error: null }) {
  const state = { _result: defaultResult as { data: unknown; error: unknown } }

  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  // Make it thenable so `await db.from(...).select(...).eq(...)` works
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    return Promise.resolve(state._result).then(resolve, reject)
  }
  chain._state = state
  return chain
}

let automationsResult: { data: unknown; error: unknown }
const insertCalls: Record<string, unknown[]> = {}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'automations') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = automationsResult
      return chain
    }
    // For any other table, capture inserts
    const chain = createSupabaseChain()
    const origInsert = chain.insert as ReturnType<typeof vi.fn>
    chain.insert = vi.fn().mockImplementation((data: unknown) => {
      if (!insertCalls[table]) insertCalls[table] = []
      insertCalls[table].push(data)
      return origInsert(data)
    })
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

import { fireAutomations } from '@/lib/automations-engine'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

describe('automations-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    automationsResult = { data: [], error: null }
    for (const key of Object.keys(insertCalls)) delete insertCalls[key]
  })

  function setupAutomations(trigger: string, actions: string[], name = 'Test Auto') {
    automationsResult = {
      data: [{ id: 'auto-1', name, trigger, actions, status: 'Active', runs: 0 }],
      error: null,
    }
  }

  it('ignores unknown events and does not query the database', async () => {
    fireAutomations('totally_unknown_event', { company: 'Acme' })
    await flushPromises()
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('fires "Create Draft Contract" on proposal_accepted', async () => {
    setupAutomations('Proposal Accepted', ['Create Draft Contract'])
    fireAutomations('proposal_accepted', {
      company: 'Acme Corp',
      proposalId: 'p-123',
      value: 50000,
      assigned_rep: 'John',
      service_type: 'Web Dev',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('automations')
    expect(mockDb.from).toHaveBeenCalledWith('contracts')
    expect(insertCalls['contracts']).toBeDefined()
    expect(insertCalls['contracts'][0]).toEqual(
      expect.objectContaining({
        company: 'Acme Corp',
        status: 'Draft',
        value: 50000,
        assigned_rep: 'John',
        service_type: 'Web Dev',
      }),
    )
  })

  it('fires "Create Billing Task" on invoice_paid', async () => {
    setupAutomations('Invoice Paid', ['Create Billing Task'])
    fireAutomations('invoice_paid', {
      company: 'Beta LLC',
      assigned_rep: 'Jane',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('app_tasks')
    expect(insertCalls['app_tasks'][0]).toEqual(
      expect.objectContaining({
        title: 'Create Billing Task: Beta LLC',
        category: 'Billing',
        status: 'Pending',
        priority: 'High',
      }),
    )
  })

  it('fires "Create Renewal Task" on renewal_30', async () => {
    setupAutomations('Renewal Date Within 30 Days', ['Create Renewal Task'])
    fireAutomations('renewal_30', {
      company: 'Gamma Inc',
      assigned_rep: 'Sam',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('app_tasks')
    expect(insertCalls['app_tasks'][0]).toEqual(
      expect.objectContaining({
        title: 'Create Renewal Task: Gamma Inc',
        category: 'Renewal',
      }),
    )
  })

  it('fires "Create Project Record" on contract_executed', async () => {
    setupAutomations('Contract Fully Executed', ['Create Project Record'])
    fireAutomations('contract_executed', {
      company: 'Delta Co',
      service_type: 'SEO',
      contractId: 'c-456',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('projects')
    expect(insertCalls['projects'][0]).toEqual(
      expect.objectContaining({
        company: 'Delta Co',
        service_type: 'SEO',
        status: 'Not Started',
        progress: 0,
        contract_id: 'c-456',
      }),
    )
  })

  it('fires "Notify Sales Rep" on deal_stage_changed', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Sales Rep'])
    fireAutomations('deal_stage_changed', {
      company: 'Echo Ltd',
      companyId: 'comp-1',
      trigger: 'Deal Stage Changed',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('crm_activities')
    expect(insertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({
        type: 'Notification',
        logged_by: 'System',
      }),
    )
  })

  it('fires "Log Activity" on contact_created', async () => {
    setupAutomations('Contact Created', ['Log Activity'])
    fireAutomations('contact_created', {
      company: 'Foxtrot LLC',
      companyId: 'comp-2',
      contactId: 'ct-1',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('crm_activities')
    expect(insertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({
        type: 'Note',
        logged_by: 'System',
      }),
    )
  })

  it('fires "Create Maintenance Record" on contract_sent', async () => {
    setupAutomations('Contract Sent', ['Create Maintenance Record'])
    fireAutomations('contract_sent', {
      company: 'Golf Corp',
      service_type: 'Hosting',
      contractId: 'c-789',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('maintenance_records')
    expect(insertCalls['maintenance_records'][0]).toEqual(
      expect.objectContaining({
        company: 'Golf Corp',
        service_type: 'Hosting',
        status: 'Active',
        contract_id: 'c-789',
      }),
    )
  })

  it('handles no matching automations gracefully', async () => {
    automationsResult = { data: [], error: null }
    fireAutomations('invoice_overdue', { company: 'Nobody' })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('automations')
    expect(insertCalls['app_tasks']).toBeUndefined()
    expect(insertCalls['contracts']).toBeUndefined()
  })

  it('handles database error when fetching automations', async () => {
    automationsResult = { data: null, error: { message: 'DB down' } }
    fireAutomations('proposal_accepted', { company: 'Test' })
    await flushPromises()

    // Should query automations but not proceed to actions
    expect(mockDb.from).toHaveBeenCalledWith('automations')
    expect(insertCalls['contracts']).toBeUndefined()
  })
})
