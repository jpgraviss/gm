import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUDIT.md #524 — "Apply Service Template" used to fuzzy-match a template
// by name (name was almost always undefined) and, even on a match, only
// wrote an activity note claiming the template was "applied" without ever
// reading `template.body`. This tests the real implementation: a real
// templateId, placeholder filling, and an actual email send. The shared
// mock in automations-engine.test.ts doesn't support `.maybeSingle()`
// (needed here for both document_templates and crm_contacts lookups), so
// this builds its own small per-table mock — same pattern as
// tests/integration/course-quiz-grade.test.ts.

const TEMPLATE_ROW = {
  id: 'tpl-1',
  name: 'Standard Service Agreement',
  body: 'Dear [CLIENT NAME],\n\nThis agreement with [COMPANY] is dated [DATE] for [VALUE].',
}

const CONTACT_ROW = {
  emails: ['jane@client.com'],
  full_name: 'Jane Client',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let automationsResult: { data: any; error: any } = { data: [], error: null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let templateResult: { data: any; error: any } = { data: TEMPLATE_ROW, error: null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let contactResult: { data: any; error: any } = { data: CONTACT_ROW, error: null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insertCalls: Record<string, any[]> = {}

function createDb() {
  return {
    from: (table: string) => {
      if (table === 'automations') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve(automationsResult) }) }) }
      }
      if (table === 'document_templates') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(templateResult) }) }) }
      }
      if (table === 'crm_contacts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(contactResult),
              // resolveContactId()'s company-name fallback lookup chain,
              // used only when the trigger context has no direct contactId.
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
        }
      }
      if (table === 'crm_activities') {
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          insert: (vals: any) => {
            if (!insertCalls[table]) insertCalls[table] = []
            insertCalls[table].push(vals)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      // Generic fallback for tables executeWorkflow's own bookkeeping
      // touches (automation_runs' start/finish records, the automations
      // row's `runs` counter increment) — not under test here, so just
      // resolve harmlessly instead of throwing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {}
      for (const m of ['select', 'insert', 'update', 'eq', 'order', 'limit', 'maybeSingle', 'single']) {
        chain[m] = () => chain
      }
      chain.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: null, error: null }).then(resolve)
      return chain
    },
  }
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => createDb() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email-template', () => ({ wrapBrandedEmail: vi.fn((body: string) => Promise.resolve(`<html>${body}</html>`)) }))

import { fireAutomations } from '@/lib/automations-engine'
import { sendEmail } from '@/lib/email'

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 50))
}

describe('automations-engine: Apply Service Template', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    automationsResult = {
      data: [{
        id: 'auto-1',
        name: 'Test Auto',
        trigger: 'Contract Sent',
        actions: [{ type: 'Apply Service Template', config: { templateId: 'tpl-1' } }],
        status: 'Active',
        runs: 0,
      }],
      error: null,
    }
    templateResult = { data: TEMPLATE_ROW, error: null }
    contactResult = { data: CONTACT_ROW, error: null }
    for (const key of Object.keys(insertCalls)) delete insertCalls[key]
    vi.mocked(sendEmail).mockResolvedValue({ success: true, id: 'msg-1' })
  })

  it('does nothing when no templateId is configured', async () => {
    automationsResult.data[0].actions = [{ type: 'Apply Service Template', config: {} }]
    fireAutomations('contract_sent', { company: 'Acme', contactId: 'ct-1' })
    await flushPromises()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(insertCalls['crm_activities']).toBeUndefined()
  })

  it('does nothing when the template has no body', async () => {
    templateResult = { data: { id: 'tpl-1', name: 'Empty', body: '' }, error: null }
    fireAutomations('contract_sent', { company: 'Acme', contactId: 'ct-1' })
    await flushPromises()

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the account has no resolvable contact', async () => {
    fireAutomations('contract_sent', { company: 'Acme' }) // no contactId, no company match path mocked
    await flushPromises()

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does nothing when the contact has no email on file', async () => {
    contactResult = { data: { emails: [], full_name: 'No Email Guy' }, error: null }
    fireAutomations('contract_sent', { company: 'Acme', contactId: 'ct-1' })
    await flushPromises()

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('fills real placeholders and emails the actual template body', async () => {
    fireAutomations('contract_sent', { company: 'Acme Corp', contactId: 'ct-1', value: 5000 })
    await flushPromises()

    expect(sendEmail).toHaveBeenCalledTimes(1)
    const call = vi.mocked(sendEmail).mock.calls[0][0]
    expect(call.to).toBe('jane@client.com')
    expect(call.html).toContain('Dear Jane Client')
    expect(call.html).toContain('This agreement with Acme Corp')
    expect(call.html).toContain('$5,000')
    expect(call.html).not.toContain('[CLIENT NAME]')
    expect(call.html).not.toContain('[COMPANY]')
    expect(call.html).not.toContain('[VALUE]')
  })

  it('logs the full filled document to crm_activities on success', async () => {
    fireAutomations('contract_sent', { company: 'Acme Corp', contactId: 'ct-1', companyId: 'comp-1', value: 5000 })
    await flushPromises()

    expect(insertCalls['crm_activities']).toBeDefined()
    const activity = insertCalls['crm_activities'][0]
    expect(activity.type).toBe('document')
    expect(activity.outcome).toBe('success')
    expect(activity.body).toContain('Dear Jane Client')
    expect(activity.company_id).toBe('comp-1')
    expect(activity.contact_id).toBe('ct-1')
  })

  it('logs a failed outcome when the email send fails', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ success: false, error: 'Resend down' })
    fireAutomations('contract_sent', { company: 'Acme Corp', contactId: 'ct-1' })
    await flushPromises()

    const activity = insertCalls['crm_activities'][0]
    expect(activity.outcome).toBe('failed')
    expect(activity.title).toContain('Failed to send')
  })
})
