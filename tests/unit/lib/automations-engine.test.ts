import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a chainable mock that supports Supabase's fluent API.
// Every method returns the same chain object, and the chain is also "thenable"
// so it can be awaited. The resolved value is controlled via `_result`.
function createSupabaseChain(defaultResult = { data: null, error: null }) {
  const state = { _result: defaultResult as { data: unknown; error: unknown } }

  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single', 'maybeSingle']
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
// AUDIT #611 test support — team_members lookup result for Update Contact's
// owner-name-to-owner_id resolution. Defaults to "no match" so existing
// tests that never touch this table are unaffected.
let teamMemberResult: { data: unknown; error: unknown } = { data: null, error: null }
// AUDIT #629 test support — app_settings.pipelines lookup for "Create
// Deal"'s stage fallback. Defaults to "no custom pipeline saved" (falls
// back to DEFAULT_PIPELINES) so existing tests are unaffected.
let appSettingsResult: { data: unknown; error: unknown } = { data: null, error: null }
const insertCalls: Record<string, unknown[]> = {}
const updateCalls: Record<string, unknown[]> = {}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'automations') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = automationsResult
      return chain
    }
    if (table === 'team_members') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = teamMemberResult
      return chain
    }
    if (table === 'app_settings') {
      const chain = createSupabaseChain();
      (chain._state as { _result: unknown })._result = appSettingsResult
      return chain
    }
    // For any other table, capture inserts and updates
    const chain = createSupabaseChain()
    const origInsert = chain.insert as (data: unknown) => unknown
    chain.insert = vi.fn().mockImplementation((data: unknown) => {
      if (!insertCalls[table]) insertCalls[table] = []
      insertCalls[table].push(data)
      return origInsert(data)
    })
    const origUpdate = chain.update as (data: unknown) => unknown
    chain.update = vi.fn().mockImplementation((data: unknown) => {
      if (!updateCalls[table]) updateCalls[table] = []
      updateCalls[table].push(data)
      return origUpdate(data)
    })
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

import { fireAutomations, executeWorkflow } from '@/lib/automations-engine'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

describe('automations-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    automationsResult = { data: [], error: null }
    teamMemberResult = { data: null, error: null }
    appSettingsResult = { data: null, error: null }
    for (const key of Object.keys(insertCalls)) delete insertCalls[key]
    for (const key of Object.keys(updateCalls)) delete updateCalls[key]
  })

  type RawAction = string | { type: string; config?: Record<string, unknown> }
  function setupAutomations(trigger: string, actions: RawAction[], name = 'Test Auto', config: Record<string, unknown> = {}) {
    automationsResult = {
      data: [{ id: 'auto-1', name, trigger, actions, status: 'Active', runs: 0, config }],
      error: null,
    }
  }

  it('ignores unknown events and does not query the database', async () => {
    fireAutomations('totally_unknown_event', { company: 'TestCo' })
    await flushPromises()
    expect(mockDb.from).not.toHaveBeenCalled()
  })

  it('fires "Create Draft Contract" on proposal_accepted', async () => {
    setupAutomations('Proposal Accepted', ['Create Draft Contract'])
    fireAutomations('proposal_accepted', {
      company: 'Test Company',
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
        company: 'Test Company',
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
      assigned_rep: 'Tester',
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
        type: 'note',
        user_name: 'System',
      }),
    )
  })

  it('deal_stage_changed: fires when config.stage matches the triggered stage', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Sales Rep'], 'Test Auto', { stage: 'Closed Won' })
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', stage: 'Closed Won' })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeDefined()
  })

  it('deal_stage_changed: skips when config.stage does not match the triggered stage', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Sales Rep'], 'Test Auto', { stage: 'Closed Won' })
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', stage: 'Qualified' })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeUndefined()
  })

  it('deal_stage_changed: fires on any stage when config.stage is unset', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Sales Rep'])
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', stage: 'Qualified' })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeDefined()
  })

  it('invoice_overdue: fires when config.overdueDays matches the real triggerData value', async () => {
    setupAutomations('Invoice Overdue', ['Notify Sales Rep'], 'Test Auto', { overdueDays: 3 })
    fireAutomations('invoice_overdue', { company: 'Foxtrot LLC', overdueDays: 3 })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeDefined()
  })

  it('invoice_overdue: skips when config.overdueDays does not match (e.g. day-0 fire against a 3-day-configured automation)', async () => {
    setupAutomations('Invoice Overdue', ['Notify Sales Rep'], 'Test Auto', { overdueDays: 3 })
    fireAutomations('invoice_overdue', { company: 'Foxtrot LLC' }) // no overdueDays = the initial day-0 fire
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeUndefined()
  })

  it('webhook_received: fires when triggerData.webhookToken matches config.webhookToken', async () => {
    setupAutomations('Webhook Received', ['Notify Sales Rep'], 'Test Auto', { webhookToken: 'abc123' })
    fireAutomations('webhook_received', { company: 'Golf Inc', webhookToken: 'abc123' })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeDefined()
  })

  it('webhook_received: skips when the token does not match (a different automation\'s webhook)', async () => {
    setupAutomations('Webhook Received', ['Notify Sales Rep'], 'Test Auto', { webhookToken: 'abc123' })
    fireAutomations('webhook_received', { company: 'Golf Inc', webhookToken: 'xyz789' })
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeUndefined()
  })

  it('webhook_received: skips when the automation has no token configured at all, even if triggerData also has none', async () => {
    setupAutomations('Webhook Received', ['Notify Sales Rep']) // no config.webhookToken
    fireAutomations('webhook_received', { company: 'Golf Inc' }) // no webhookToken either
    await flushPromises()
    expect(insertCalls['crm_activities']).toBeUndefined()
  })

  // Regression tests for a hardcoded 'Delivery' unit name that never
  // matched the real OccupationalUnit value 'Delivery/Operations' —
  // "Notify Delivery Team" and Send Notification's delivery_team target
  // both silently notified zero people, with no error, since no
  // team_members row has unit === 'Delivery'.
  it('"Notify Delivery Team" queries team_members by the real "Delivery/Operations" unit, not the stale "Delivery" value', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Delivery Team'])
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', companyId: 'comp-1' })
    await flushPromises()

    const callIndex = mockDb.from.mock.calls.findIndex(([table]) => table === 'team_members')
    expect(callIndex).toBeGreaterThanOrEqual(0)
    const teamMembersChain = mockDb.from.mock.results[callIndex].value as { eq: ReturnType<typeof vi.fn> }
    const unitCall = teamMembersChain.eq.mock.calls.find((call: unknown[]) => call[0] === 'unit')
    expect(unitCall?.[1]).toBe('Delivery/Operations')
  })

  it('Send Notification\'s delivery_team target resolves against "Delivery/Operations", not "Delivery"', async () => {
    setupAutomations('Contact Created', [{ type: 'Send Notification', config: { target: 'delivery_team', message: 'New contact' } }])
    fireAutomations('contact_created', { company: 'Echo Ltd' })
    await flushPromises()

    const callIndex = mockDb.from.mock.calls.findIndex(([table]) => table === 'team_members')
    expect(callIndex).toBeGreaterThanOrEqual(0)
    const teamMembersChain = mockDb.from.mock.results[callIndex].value as { eq: ReturnType<typeof vi.fn> }
    const unitCall = teamMembersChain.eq.mock.calls.find((call: unknown[]) => call[0] === 'unit')
    expect(unitCall?.[1]).toBe('Delivery/Operations')
  })

  // AUDIT #600 — Notify Sales Rep/Finance Team/Delivery Team/Assigned Rep,
  // Log Touchpoint, and Flag in Dashboard resolved company_id/contact_id
  // camelCase-only, unlike Log Activity/Send Notification's existing
  // snake_case fallback — necessary because most real trigger contexts are
  // built by spreading a raw (snake_case) DB row.
  it('"Notify Sales Rep" falls back to snake_case company_id/contact_id when the context has no camelCase keys', async () => {
    setupAutomations('Deal Stage Changed', ['Notify Sales Rep'])
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', company_id: 'comp-snake', contact_id: 'contact-snake' })
    await flushPromises()

    expect(insertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({ company_id: 'comp-snake', contact_id: 'contact-snake' }),
    )
  })

  it('"Log Touchpoint" falls back to snake_case company_id/contact_id', async () => {
    setupAutomations('Deal Stage Changed', ['Log Touchpoint'])
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', company_id: 'comp-snake', contact_id: 'contact-snake' })
    await flushPromises()

    expect(insertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({ company_id: 'comp-snake', contact_id: 'contact-snake' }),
    )
  })

  it('"Flag in Dashboard" falls back to snake_case company_id', async () => {
    setupAutomations('Deal Stage Changed', ['Flag in Dashboard'])
    fireAutomations('deal_stage_changed', { company: 'Echo Ltd', company_id: 'comp-snake' })
    await flushPromises()

    expect(insertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({ company_id: 'comp-snake' }),
    )
  })

  // AUDIT.md #554 — sequence_reply/sequence_bounce/sequence_completed are
  // inherently scoped to one sequence; without this guard, an automation
  // built for Sequence A's replies would fire for every sequence's replies
  // company-wide, since the trigger fetch only matches on trigger label.
  describe('sequence-event scoping (#554)', () => {
    const automation = {
      id: 'auto-seq-1', name: 'Reply follow-up', trigger: 'Sequence Contact Replied',
      actions: [{ type: 'Create Task', config: { title: 'Follow up' } }], status: 'Active', runs: 0,
      config: { sequenceId: 'seq-A' },
    }

    it('fires when triggerData.sequenceId matches automation.config.sequenceId', async () => {
      const result = await executeWorkflow(
        automation, 'sequence_reply',
        { sequenceId: 'seq-A', company: 'Acme Co', contactId: 'ct-1' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockDb as any,
      )
      await flushPromises()
      expect(result.status).not.toBe('skipped')
      expect(insertCalls['app_tasks']).toBeDefined()
    })

    it('skips when triggerData.sequenceId does not match — a different sequence\'s reply must not fire this automation', async () => {
      const result = await executeWorkflow(
        automation, 'sequence_reply',
        { sequenceId: 'seq-B', company: 'Acme Co', contactId: 'ct-1' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockDb as any,
      )
      expect(result.status).toBe('skipped')
      expect(insertCalls['app_tasks']).toBeUndefined()
    })

    it('skips when the automation has no sequenceId configured at all, rather than firing broadly', async () => {
      const unscoped = { ...automation, config: {} }
      const result = await executeWorkflow(
        unscoped, 'sequence_reply',
        { sequenceId: 'seq-A', company: 'Acme Co', contactId: 'ct-1' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockDb as any,
      )
      expect(result.status).toBe('skipped')
      expect(insertCalls['app_tasks']).toBeUndefined()
    })
  })

  // AUDIT #611 — Update Contact's "Owner" field only wrote the
  // display-only `owner` text column, never the real `owner_id` FK that
  // dynamic sequence-sender resolution and the "Recently engaged leads"
  // widget actually read.
  describe('Update Contact owner field writes owner_id (#611)', () => {
    it('resolves the typed name to an active team member and writes both owner and owner_id', async () => {
      teamMemberResult = { data: { id: 'tm-1' }, error: null }

      setupAutomations('Contact Created', [{ type: 'Update Contact', config: { field: 'owner', value: 'Jamie Rep' } }])
      fireAutomations('contact_created', { company: 'Acme Co', contactId: 'ct-1' })
      await flushPromises()

      expect(updateCalls['crm_contacts']).toBeDefined()
      expect(updateCalls['crm_contacts'][0]).toEqual(
        expect.objectContaining({ owner: 'Jamie Rep', owner_id: 'tm-1' }),
      )
    })

    it('leaves owner_id untouched when the typed name matches no active team member', async () => {
      teamMemberResult = { data: null, error: null }

      setupAutomations('Contact Created', [{ type: 'Update Contact', config: { field: 'owner', value: 'Nobody Real' } }])
      fireAutomations('contact_created', { company: 'Acme Co', contactId: 'ct-1' })
      await flushPromises()

      expect(updateCalls['crm_contacts'][0]).toEqual(expect.objectContaining({ owner: 'Nobody Real' }))
      expect(updateCalls['crm_contacts'][0]).not.toHaveProperty('owner_id')
    })

    // AUDIT #646 — clearing the Owner field (empty string) only blanked the
    // display `owner` column, leaving `owner_id` stale at the previous owner.
    it('nulls owner_id when the Owner field is explicitly cleared', async () => {
      setupAutomations('Contact Created', [{ type: 'Update Contact', config: { field: 'owner', value: '' } }])
      fireAutomations('contact_created', { company: 'Acme Co', contactId: 'ct-1' })
      await flushPromises()

      expect(updateCalls['crm_contacts'][0]).toEqual(expect.objectContaining({ owner: '', owner_id: null }))
    })
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
        type: 'note',
        user_name: 'System',
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

  // AUDIT.md #13 — Wait must actually stop execution, not fall through to
  // the next action in the same pass, and it must schedule a resume with a
  // real automation_id/run_id (previously always blank, silently dropped).
  it('Wait pauses execution and schedules a resume instead of running the next action', async () => {
    setupAutomations('Contact Created', ['Add Tag', 'Wait', 'Create Task'])
    fireAutomations('contact_created', {
      company: 'Hotel India',
      contactId: 'ct-9',
      tag: 'nurture',
    })
    await flushPromises()

    // The action before Wait ran.
    expect(mockDb.from).toHaveBeenCalledWith('crm_contacts')
    // Wait scheduled a real pending step. automation_pending_steps has no
    // status/remaining_actions columns on the live table — resume position
    // is step_index (an index into the automation's own actions), matching
    // the real schema (information_schema.columns), not what an earlier
    // migration file in this repo incorrectly assumed.
    expect(insertCalls['automation_pending_steps']).toBeDefined()
    expect(insertCalls['automation_pending_steps'][0]).toEqual(
      expect.objectContaining({
        automation_id: 'auto-1',
        step_index: 2, // ['Add Tag', 'Wait', 'Create Task'] — resume at index 2
      }),
    )
    const pendingRow = insertCalls['automation_pending_steps'][0] as { run_id: string }
    expect(pendingRow.run_id).toBeTruthy()
    // ...and did NOT fall through to execute the action after it.
    expect(insertCalls['app_tasks']).toBeUndefined()
  })

  // Regression test for a bug an adversarial audit pass found in the
  // step_index fix above: cron's resumePendingAutomationSteps() calls
  // executeWorkflow with a TRUNCATED actions array (only what's left after
  // the first Wait). Without indexOffset, a second Wait inside that
  // resumed call would compute step_index relative to the truncated
  // array's own loop-local index (0-based again), not the original
  // 5-action automation cron re-slices from on the NEXT resume — causing
  // already-executed actions to run a second time and the automation to
  // loop on the same Wait forever, without ever reaching the final action.
  it('a second Wait during a resumed run computes step_index against the ORIGINAL action list, not the resumed slice', async () => {
    // Simulates exactly what cron's resumePendingAutomationSteps passes on
    // resume: the automation's actions truncated to what's left (as if the
    // original 5-action automation was [A0, Wait1, A2, Wait3, A4] and the
    // first Wait already resumed at step_index 2), plus indexOffset=2 so
    // the loop's local index 0/1/2 maps back to global index 2/3/4.
    const resumedActions = ['Add Tag', 'Wait', 'Create Task']
    await executeWorkflow(
      { id: 'auto-1', name: 'Two-Wait Auto', trigger: 'Contact Created', actions: resumedActions, status: 'Active', runs: 0 },
      'pending_resume',
      { company: 'Mike Bravo', contactId: 'ct-77', tag: 'nurture' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockDb as any,
      true,
      2, // indexOffset — this resumed call starts at global index 2
    )
    await flushPromises()

    expect(insertCalls['automation_pending_steps']).toBeDefined()
    expect(insertCalls['automation_pending_steps'][0]).toEqual(
      expect.objectContaining({
        automation_id: 'auto-1',
        // Wait is at local index 1 of resumedActions; correct global
        // step_index is indexOffset(2) + 1 + 1 = 4, pointing at the real
        // next action (Create Task) in the original 5-action array — NOT
        // 2, which is the bug (local-index-only math re-pointing at the
        // action that already ran this same resume pass).
        step_index: 4,
      }),
    )
  })

  // AUDIT.md #12/#13 plan, finding on the pre-existing If/Else bug — the
  // skip-remaining flag was set on a locally-scoped object the caller's
  // loop never actually checked, so it never skipped anything in
  // production. Confirms it now does.
  it('If/Else with a false condition skips remaining actions', async () => {
    setupAutomations('Contact Created', ['If/Else', 'Create Task'])
    fireAutomations('contact_created', {
      company: 'Juliett Corp',
      conditionField: 'company',
      conditionOperator: 'equals',
      conditionValue: 'Not Juliett Corp',
    })
    await flushPromises()

    expect(insertCalls['app_tasks']).toBeUndefined()
  })

  it('If/Else with a true condition runs remaining actions', async () => {
    setupAutomations('Contact Created', ['If/Else', 'Create Task'])
    fireAutomations('contact_created', {
      company: 'Kilo LLC',
      conditionField: 'company',
      conditionOperator: 'equals',
      conditionValue: 'Kilo LLC',
    })
    await flushPromises()

    expect(insertCalls['app_tasks']).toBeDefined()
  })

  // AUDIT.md #12, the actual reported scenario — two actions of the same
  // type must be able to carry two different values. Previously every
  // action shared one automation-level context, so two "Add Tag" actions
  // were indistinguishable.
  it('two Add Tag actions with different per-action config apply distinct tags', async () => {
    setupAutomations('Contact Created', [
      { type: 'Add Tag', config: { tag: 'nurture' } },
      { type: 'Add Tag', config: { tag: 'high-value' } },
    ])
    fireAutomations('contact_created', { company: 'Lima Partners', contactId: 'ct-22' })
    await flushPromises()

    expect(updateCalls['crm_contacts']).toBeDefined()
    const tagUpdates = (updateCalls['crm_contacts'] as { tags: string[] }[]).map(u => u.tags[0])
    expect(tagUpdates).toEqual(['nurture', 'high-value'])
  })

  // AUDIT.md #12/#13 plan, key-translation finding — the builder UI's
  // config field names (duration/unit) don't match the engine's context
  // keys (waitDuration/waitUnit) for 7 of 9 configurable action types.
  // Confirms the adapter layer actually translates them, using Wait's
  // resume_at as the observable proof (a wrong translation would silently
  // fall back to the 1-hour default instead of the configured 30 minutes).
  it('per-action config is translated into the keys each action actually reads (Wait duration/unit)', async () => {
    setupAutomations('Contact Created', [
      { type: 'Wait', config: { duration: 30, unit: 'minutes' } },
    ])
    const before = Date.now()
    fireAutomations('contact_created', { company: 'Mike Ventures', contactId: 'ct-30' })
    await flushPromises()

    expect(insertCalls['automation_pending_steps']).toBeDefined()
    const pendingRow = insertCalls['automation_pending_steps'][0] as { resume_at: string }
    const resumeMs = new Date(pendingRow.resume_at).getTime() - before
    // ~30 minutes, generously bounded — would be ~60 minutes (the default)
    // if the config translation silently failed.
    expect(resumeMs).toBeGreaterThan(29 * 60_000)
    expect(resumeMs).toBeLessThan(31 * 60_000)
  })

  // A bare string action alongside an object-shape action in the same
  // automation must keep working — the migration backfills every existing
  // row to {type, config:{}}, but the engine's normalizeAction() defensive
  // fallback should tolerate either shape regardless.
  it('tolerates a mix of legacy bare-string and new object-shape actions', async () => {
    setupAutomations('Contact Created', ['Add Tag', { type: 'Create Task', config: { title: 'Follow up' } }])
    fireAutomations('contact_created', { company: 'November Inc', contactId: 'ct-31', tag: 'legacy' })
    await flushPromises()

    expect(insertCalls['app_tasks']).toBeDefined()
    expect(insertCalls['app_tasks'][0]).toEqual(expect.objectContaining({ title: 'Follow up' }))
  })

  // AUDIT.md #46 — Rotate Contact Owner reassigns real CRM ownership and
  // must not be forgeable via the public, unauthenticated funnel-submit /
  // generic-forms endpoints (both stamp _publicSource: true on the trigger
  // context they fire).
  it('Rotate Contact Owner refuses to execute when triggered from a public source', async () => {
    setupAutomations('Form Submitted', ['Rotate Contact Owner'])
    fireAutomations('form_submitted', {
      contactId: 'ct-40',
      unit: 'Sales',
      _publicSource: true,
    })
    await flushPromises()

    expect(mockDb.from).not.toHaveBeenCalledWith('team_members')
  })

  it('Rotate Contact Owner executes normally when not from a public source', async () => {
    setupAutomations('Form Submitted', ['Rotate Contact Owner'])
    fireAutomations('form_submitted', {
      contactId: 'ct-41',
      unit: 'Sales',
    })
    await flushPromises()

    expect(mockDb.from).toHaveBeenCalledWith('team_members')
  })

  // AUDIT #629 — "Create Deal"'s runtime default stage was hardcoded to
  // the literal 'Lead' instead of reading the real, saved pipeline's first
  // stage (matching #516's fix for the builder dropdown/AI generator).
  // Since pipeline stages are user-renamable, a deal created this way after
  // an admin renames the first stage would land on a non-existent stage
  // name and become invisible on the Pipeline board.
  describe('Create Deal stage fallback (#629)', () => {
    const automation = {
      id: 'auto-deal-1', name: 'Auto-create deal', trigger: 'Form Submitted',
      actions: [{ type: 'Create Deal', config: {} }], status: 'Active', runs: 0,
      config: {},
    }

    it('reads the real first pipeline stage instead of hardcoding "Lead"', async () => {
      appSettingsResult = {
        data: {
          pipelines: [{
            id: 'client-acquisition',
            name: 'Client Acquisition',
            stages: [{ id: 'ca-0', name: 'New Lead In', color: '#000', probability: 10 }],
          }],
        },
        error: null,
      }

      await executeWorkflow(
        automation, 'form_submitted',
        { company: 'Acme Co', contactId: 'ct-1' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockDb as any,
      )
      await flushPromises()

      expect(insertCalls['deals'][0]).toEqual(expect.objectContaining({ stage: 'New Lead In' }))
    })
  })
})
