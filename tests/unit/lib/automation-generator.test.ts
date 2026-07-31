import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChatCompletion = vi.fn()
vi.mock('@/lib/ai-client', () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}))

import { generateAutomation, VALID_TRIGGERS } from '@/lib/automation-generator'

beforeEach(() => {
  mockChatCompletion.mockReset()
})

describe('generateAutomation', () => {
  it('returns null with an error when no AI provider is reachable', async () => {
    mockChatCompletion.mockResolvedValue({ text: '', toolCalls: [], finishReason: 'error', source: 'none' })
    const result = await generateAutomation('email me when an invoice is overdue')
    expect(result.automation).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('returns null with an error when the AI response is not valid JSON', async () => {
    mockChatCompletion.mockResolvedValue({ text: 'not json at all', toolCalls: [], finishReason: 'stop', source: 'groq' })
    const result = await generateAutomation('email me when an invoice is overdue')
    expect(result.automation).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('parses a well-formed response and passes through real triggers/actions unchanged', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'Overdue invoice reminder',
        trigger: 'Invoice Overdue',
        actions: [
          { type: 'Send Email Reminder', config: { subject: 'Your invoice is overdue', body: 'Please pay.' } },
          { type: 'Notify Finance Team', config: {} },
        ],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('email the client and notify finance when an invoice is overdue')
    expect(result.automation).not.toBeNull()
    expect(result.automation!.trigger).toBe('Invoice Overdue')
    expect(result.automation!.actions).toEqual([
      { type: 'Send Email Reminder', config: { subject: 'Your invoice is overdue', body: 'Please pay.' } },
      { type: 'Notify Finance Team', config: {} },
    ])
    expect(result.automation!.warnings).toEqual([])
  })

  it('strips markdown code fences before parsing', async () => {
    mockChatCompletion.mockResolvedValue({
      text: '```json\n' + JSON.stringify({ name: 'x', trigger: 'Contact Created', actions: [{ type: 'Log Activity', config: { note: 'hi' } }], warnings: [] }) + '\n```',
      toolCalls: [], finishReason: 'stop', source: 'gemini',
    })
    const result = await generateAutomation('log activity when a contact is created')
    expect(result.automation).not.toBeNull()
    expect(result.automation!.trigger).toBe('Contact Created')
  })

  it('drops an invented trigger instead of persisting a dead automation, and warns', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ name: 'x', trigger: 'Deal Created', actions: [{ type: 'Log Activity', config: {} }], warnings: [] }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('do something when a deal is created')
    expect(result.automation).not.toBeNull()
    expect(VALID_TRIGGERS).not.toContain('Deal Created')
    expect(VALID_TRIGGERS).toContain(result.automation!.trigger)
    expect(result.automation!.warnings.some(w => w.includes('Deal Created'))).toBe(true)
  })

  it('drops an invented action type instead of persisting a dead action, and warns', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', trigger: 'Contact Created',
        actions: [{ type: 'Send Welcome Sequence', config: {} }, { type: 'Log Activity', config: { note: 'ok' } }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('welcome a new contact')
    expect(result.automation!.actions).toEqual([{ type: 'Log Activity', config: { note: 'ok' } }])
    expect(result.automation!.warnings.some(w => w.includes('Send Welcome Sequence'))).toBe(true)
  })

  it('coerces numeric config fields and drops empty-string ones', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', trigger: 'Contact Created',
        actions: [{ type: 'Create Task', config: { title: 'Call them', assignee: '', dueDateOffset: '3' } }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('create a follow-up task')
    expect(result.automation!.actions[0].config).toEqual({ title: 'Call them', dueDateOffset: 3 })
  })

  it('warns when the AI proposes zero real actions', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ name: 'x', trigger: 'Contact Created', actions: [], warnings: [] }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('do nothing useful')
    expect(result.automation!.actions).toEqual([])
    expect(result.automation!.warnings.length).toBeGreaterThan(0)
  })

  // AUDIT.md #508 — executeAction() (lib/automations-engine.ts) silently
  // no-ops 'Generate Proposal' for every trigger except 'Form Submitted'.
  // Left unguarded here, the AI could produce a clean, "Active"-looking
  // automation that never actually fires — normalizeAutomation() must drop
  // it under any other trigger rather than let it through.
  it('drops "Generate Proposal" under any trigger other than Form Submitted, and warns', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', trigger: 'Deal Stage Changed',
        actions: [{ type: 'Generate Proposal', config: {} }, { type: 'Log Activity', config: { note: 'ok' } }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('generate a proposal when a deal closes won')
    expect(result.automation!.actions).toEqual([{ type: 'Log Activity', config: { note: 'ok' } }])
    expect(result.automation!.warnings.some(w => w.includes('Generate Proposal'))).toBe(true)
  })

  it('keeps "Generate Proposal" when paired with the Form Submitted trigger', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', trigger: 'Form Submitted',
        actions: [{ type: 'Generate Proposal', config: {} }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateAutomation('generate a proposal when the intake form is submitted')
    expect(result.automation!.actions).toEqual([{ type: 'Generate Proposal', config: {} }])
    expect(result.automation!.warnings).toEqual([])
  })
})
