import { describe, it, expect, beforeEach, vi } from 'vitest'

// lib/delivery-sync.ts advances the 8-step Delivery Workflow from events that
// happen in Contracts / Finance / Portal. These tests pin the properties the
// module exists for: it only ever moves a step forward, it's idempotent under
// at-least-once delivery (the Stripe webhook), it scopes to the right service
// line when a company runs several, and it never throws into its caller.

interface WorkflowRow {
  id: string
  company_id: string | null
  company_name: string | null
  service_type: string | null
  [col: string]: unknown
}

let workflows: WorkflowRow[] = []
let updateCalls: { id: string; update: Record<string, unknown> }[] = []
let events: Record<string, unknown>[] = []
let updateError: string | null = null
let throwOnClient = false

function workflow(over: Partial<WorkflowRow> = {}): WorkflowRow {
  return {
    id: 'wf-1',
    company_id: 'co-1',
    company_name: 'ADCO Inc',
    service_type: 'Website',
    step_01_agreement: 'Pending',
    step_02_invoice: 'Pending',
    step_04_portal: 'Pending',
    ...over,
  }
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => {
    if (throwOnClient) throw new Error('no service key')
    return {
      from(table: string) {
        if (table === 'delivery_events') {
          return { insert: async (row: Record<string, unknown>) => { events.push(row); return { error: null } } }
        }
        return {
          select: () => ({
            // findWorkflows awaits the builder returned by .eq() directly.
            eq: (col: string, val: string) => Promise.resolve({
              data: workflows.filter(w => w[col] === val),
              error: null,
            }),
          }),
          update: (update: Record<string, unknown>) => ({
            eq: (_c: string, id: string) => ({
              not: (statusCol: string) => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (updateError) return { data: null, error: { message: updateError } }
                    const row = workflows.find(w => w.id === id)
                    // Mirror the WHERE-clause guard: a terminal step matches
                    // no rows, so the update is a no-op.
                    if (!row || row[statusCol] === 'Completed' || row[statusCol] === 'Skipped') {
                      return { data: null, error: null }
                    }
                    Object.assign(row, update)
                    updateCalls.push({ id, update })
                    return { data: { id }, error: null }
                  },
                }),
              }),
            }),
          }),
        }
      },
    }
  },
}))

import {
  advanceDeliveryStep,
  onContractFullyExecuted,
  onInvoicePaid,
  onPortalFirstLogin,
} from '@/lib/delivery-sync'

beforeEach(() => {
  workflows = []
  updateCalls = []
  events = []
  updateError = null
  throwOnClient = false
})

describe('advanceDeliveryStep', () => {
  it('completes a pending step and stamps its completed_at column', async () => {
    workflows = [workflow()]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1 })).toBe(1)
    expect(workflows[0].step_01_agreement).toBe('Completed')
    expect(workflows[0].step_01_completed_at).toBeTruthy()
  })

  it('is a no-op on a step already Completed — never regresses it', async () => {
    workflows = [workflow({ step_01_agreement: 'Completed' })]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1 })).toBe(0)
    expect(updateCalls).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('leaves a step a staff member deliberately Skipped alone', async () => {
    workflows = [workflow({ step_01_agreement: 'Skipped' })]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1 })).toBe(0)
    expect(workflows[0].step_01_agreement).toBe('Skipped')
  })

  it('is idempotent across repeated calls (at-least-once webhook delivery)', async () => {
    workflows = [workflow()]
    await advanceDeliveryStep({ companyId: 'co-1', step: 2 })
    await advanceDeliveryStep({ companyId: 'co-1', step: 2 })
    await advanceDeliveryStep({ companyId: 'co-1', step: 2 })
    expect(updateCalls).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('advances only the matching service line when a company runs several', async () => {
    workflows = [
      workflow({ id: 'wf-web', service_type: 'Website' }),
      workflow({ id: 'wf-seo', service_type: 'SEO' }),
    ]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1, serviceType: 'SEO' })).toBe(1)
    expect(workflows.find(w => w.id === 'wf-seo')!.step_01_agreement).toBe('Completed')
    expect(workflows.find(w => w.id === 'wf-web')!.step_01_agreement).toBe('Pending')
  })

  it('falls back to every workflow when no service matches — the event is client-level', async () => {
    workflows = [
      workflow({ id: 'wf-web', service_type: 'Website' }),
      workflow({ id: 'wf-seo', service_type: 'SEO' }),
    ]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1, serviceType: 'Paid Ads' })).toBe(2)
  })

  it('matches a legacy workflow by normalized company name when no FK exists', async () => {
    workflows = [workflow({ company_id: null, company_name: 'ADCO Inc' })]
    expect(await advanceDeliveryStep({ companyName: 'ADCO Inc', step: 1 })).toBe(1)
  })

  it('does nothing when neither a company id nor a name is supplied', async () => {
    workflows = [workflow()]
    expect(await advanceDeliveryStep({ step: 1 })).toBe(0)
  })

  it('ignores an unknown step number rather than writing a bogus column', async () => {
    workflows = [workflow()]
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 99 })).toBe(0)
    expect(updateCalls).toHaveLength(0)
  })

  it('drops meta keys that do not belong to the step', async () => {
    workflows = [workflow()]
    await advanceDeliveryStep({
      companyId: 'co-1',
      step: 1,
      meta: { step_01_contract_id: 'c-9', step_05_notes: 'wrong step' },
    })
    expect(updateCalls[0].update.step_01_contract_id).toBe('c-9')
    expect(updateCalls[0].update).not.toHaveProperty('step_05_notes')
  })

  it('swallows a database error instead of failing the caller', async () => {
    workflows = [workflow()]
    updateError = 'permission denied'
    expect(await advanceDeliveryStep({ companyId: 'co-1', step: 1 })).toBe(0)
    expect(events).toHaveLength(0)
  })

  it('swallows a client-construction failure', async () => {
    throwOnClient = true
    await expect(advanceDeliveryStep({ companyId: 'co-1', step: 1 })).resolves.toBe(0)
  })

  it('records a delivery_events row describing the automatic advance', async () => {
    workflows = [workflow()]
    await advanceDeliveryStep({ companyId: 'co-1', step: 1, reason: 'Contract fully executed' })
    expect(events[0]).toMatchObject({
      workflow_id: 'wf-1',
      step: 1,
      event_type: 'step_auto_completed',
      description: 'Contract fully executed',
    })
  })
})

describe('event helpers', () => {
  it('onContractFullyExecuted completes step 1 and links the contract', async () => {
    workflows = [workflow()]
    await onContractFullyExecuted({ id: 'c-1', company_id: 'co-1', company: 'ADCO Inc', service_type: 'Website' })
    expect(workflows[0].step_01_agreement).toBe('Completed')
    expect(workflows[0].step_01_contract_id).toBe('c-1')
  })

  it('onInvoicePaid completes step 2 and links the invoice', async () => {
    workflows = [workflow()]
    await onInvoicePaid({ id: 'inv-1', company_id: 'co-1', company: 'ADCO Inc', service_type: 'Website' })
    expect(workflows[0].step_02_invoice).toBe('Completed')
    expect(workflows[0].step_02_invoice_id).toBe('inv-1')
  })

  it('onPortalFirstLogin completes step 4 and stamps the login time', async () => {
    workflows = [workflow()]
    await onPortalFirstLogin({ company_id: 'co-1', company: 'ADCO Inc' })
    expect(workflows[0].step_04_portal).toBe('Completed')
    expect(workflows[0].step_04_first_login).toBeTruthy()
  })

  it('onPortalFirstLogin on a later login does not overwrite the first', async () => {
    workflows = [workflow()]
    await onPortalFirstLogin({ company_id: 'co-1', company: 'ADCO Inc' })
    const first = workflows[0].step_04_first_login
    await onPortalFirstLogin({ company_id: 'co-1', company: 'ADCO Inc' })
    expect(workflows[0].step_04_first_login).toBe(first)
  })
})
