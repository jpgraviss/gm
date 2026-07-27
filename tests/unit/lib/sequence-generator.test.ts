import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChatCompletion = vi.fn()
vi.mock('@/lib/ai-client', () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}))

import { generateSequence } from '@/lib/sequence-generator'

beforeEach(() => {
  mockChatCompletion.mockReset()
})

describe('generateSequence', () => {
  it('returns null with an error when no AI provider is reachable', async () => {
    mockChatCompletion.mockResolvedValue({ text: '', toolCalls: [], finishReason: 'error', source: 'none' })
    const result = await generateSequence('a 3-touch nurture sequence')
    expect(result.sequence).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('returns null with an error when the AI response is not valid JSON', async () => {
    mockChatCompletion.mockResolvedValue({ text: 'nope', toolCalls: [], finishReason: 'stop', source: 'groq' })
    const result = await generateSequence('a 3-touch nurture sequence')
    expect(result.sequence).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('parses a well-formed multi-step sequence', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'SEO Lead Nurture',
        targetSegment: 'Inbound SEO leads',
        trigger: 'Contact tagged as New Lead + Service = SEO',
        steps: [
          { type: 'email', day: 0, subject: 'Welcome', body: 'Thanks for reaching out.' },
          { type: 'email', day: 3, subject: 'Following up', body: 'Just checking in.' },
          { type: 'task', day: 7, taskTitle: 'Call the lead', body: 'Try a phone call.', taskPriority: 'High' },
        ],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateSequence('a 3-touch nurture sequence for SEO leads')
    expect(result.sequence).not.toBeNull()
    expect(result.sequence!.steps).toHaveLength(3)
    expect(result.sequence!.steps[0]).toMatchObject({ type: 'email', day: 0, subject: 'Welcome' })
    expect(result.sequence!.steps[2]).toMatchObject({ type: 'task', day: 7, taskTitle: 'Call the lead', taskPriority: 'High' })
    // every step gets a unique id
    const ids = new Set(result.sequence!.steps.map(s => s.id))
    expect(ids.size).toBe(3)
  })

  it('defaults an unrecognized step type to email and warns, rather than dropping it silently', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', targetSegment: '', trigger: '',
        steps: [{ type: 'linkedin_dm', day: 0, subject: 'Hi', body: 'body' }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateSequence('a linkedin outreach sequence')
    expect(result.sequence!.steps[0].type).toBe('email')
    expect(result.sequence!.warnings.some(w => w.includes('linkedin_dm'))).toBe(true)
  })

  it('clamps an invalid taskPriority to Medium', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', targetSegment: '', trigger: '',
        steps: [{ type: 'task', day: 0, taskTitle: 'Do it', taskPriority: 'Urgent' }],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateSequence('a sequence with a task')
    expect(result.sequence!.steps[0].taskPriority).toBe('Medium')
  })

  it('forces day offsets to be non-decreasing across steps', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({
        name: 'x', targetSegment: '', trigger: '',
        steps: [
          { type: 'email', day: 5, subject: 'A', body: 'a' },
          { type: 'email', day: 2, subject: 'B', body: 'b' }, // regresses backwards
          { type: 'email', day: 2, subject: 'C', body: 'c' }, // same day as previous
        ],
        warnings: [],
      }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateSequence('a sequence with out-of-order days')
    const days = result.sequence!.steps.map(s => s.day)
    expect(days[0]).toBe(5)
    expect(days[1]).toBeGreaterThanOrEqual(days[0])
    expect(days[2]).toBeGreaterThan(days[1])
  })

  it('warns when the AI proposes zero real steps', async () => {
    mockChatCompletion.mockResolvedValue({
      text: JSON.stringify({ name: 'x', targetSegment: '', trigger: '', steps: [], warnings: [] }),
      toolCalls: [], finishReason: 'stop', source: 'groq',
    })
    const result = await generateSequence('an empty sequence')
    expect(result.sequence!.steps).toEqual([])
    expect(result.sequence!.warnings.length).toBeGreaterThan(0)
  })
})
