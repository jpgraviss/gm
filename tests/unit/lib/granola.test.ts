import { describe, it, expect, vi, beforeEach } from 'vitest'

function createChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'upsert', 'update', 'eq', 'overlaps', 'limit', 'maybeSingle']
  for (const m of methods) chain[m] = vi.fn().mockImplementation(() => chain)
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

let appSettingsResult: { data: unknown; error: unknown }
let existingNoteResult: { data: unknown; error: unknown }
let contactResult: { data: unknown; error: unknown }
const upsertCalls: Record<string, unknown[]> = {}
const updateCalls: Record<string, unknown[]> = {}

function trackUpsert(chain: Record<string, unknown>, table: string) {
  const origUpsert = chain.upsert as (data: unknown) => unknown
  chain.upsert = vi.fn().mockImplementation((data: unknown) => {
    if (!upsertCalls[table]) upsertCalls[table] = []
    upsertCalls[table].push(data)
    return origUpsert(data)
  })
}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'app_settings') {
      const chain = createChain(appSettingsResult)
      const origUpdate = chain.update as (data: unknown) => unknown
      chain.update = vi.fn().mockImplementation((data: unknown) => {
        if (!updateCalls[table]) updateCalls[table] = []
        updateCalls[table].push(data)
        return origUpdate(data)
      })
      return chain
    }
    if (table === 'granola_meeting_notes') {
      const chain = createChain(existingNoteResult)
      trackUpsert(chain, table)
      return chain
    }
    if (table === 'crm_contacts') {
      return createChain(contactResult)
    }
    if (table === 'crm_activities') {
      const chain = createChain({ data: null, error: null })
      trackUpsert(chain, table)
      return chain
    }
    return createChain({ data: null, error: null })
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

import { isGranolaConfigured, syncGranolaNotes, testGranolaConnection } from '@/lib/granola'

describe('lib/granola', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    appSettingsResult = { data: { granola: {} }, error: null }
    existingNoteResult = { data: null, error: null }
    contactResult = { data: null, error: null }
    for (const key of Object.keys(upsertCalls)) delete upsertCalls[key]
    for (const key of Object.keys(updateCalls)) delete updateCalls[key]
  })

  it('is not configured when no API key is stored, and makes zero network calls', async () => {
    appSettingsResult = { data: { granola: {} }, error: null }
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await isGranolaConfigured(mockDb as never)).toBe(false)

    const result = await syncGranolaNotes(mockDb as never)
    expect(result.error).toBe('Granola is not configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('is configured once an API key is stored', async () => {
    appSettingsResult = { data: { granola: { apiKey: 'grn_test123' } }, error: null }
    expect(await isGranolaConfigured(mockDb as never)).toBe(true)
  })

  it('testGranolaConnection reports a real failure instead of silently succeeding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'invalid key',
    }))
    const result = await testGranolaConnection('grn_bad')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('syncs a new document, matches its attendee to an existing contact, and logs a meeting activity', async () => {
    appSettingsResult = { data: { granola: { apiKey: 'grn_test123' } }, error: null }
    existingNoteResult = { data: null, error: null } // not previously synced
    contactResult = { data: { id: 'contact-1', company_id: 'company-1' }, error: null }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        id: 'doc-1',
        title: 'Kickoff call',
        summary_markdown: 'Discussed scope and timeline.',
        attendees: [{ name: 'Jane Client', email: 'jane@client.com' }],
        updated_at: '2026-07-10T12:00:00Z',
      }]),
    }))

    const result = await syncGranolaNotes(mockDb as never)

    expect(result.fetched).toBe(1)
    expect(result.imported).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.matched).toBe(1)
    expect(result.skipped).toBe(0)

    expect(upsertCalls['granola_meeting_notes']).toBeDefined()
    expect(upsertCalls['granola_meeting_notes'][0]).toEqual(
      expect.objectContaining({
        granola_document_id: 'doc-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
      }),
    )

    expect(upsertCalls['crm_activities']).toBeDefined()
    expect(upsertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({
        type: 'meeting',
        title: 'Kickoff call',
        contact_id: 'contact-1',
        company_id: 'company-1',
      }),
    )

    expect(updateCalls['app_settings']).toBeDefined()
    expect((updateCalls['app_settings'][0] as { granola: { lastSyncedAt: string } }).granola.lastSyncedAt).toBe('2026-07-10T12:00:00Z')
  })

  it('records a document with no attendee match, but does not fabricate a CRM activity for it', async () => {
    appSettingsResult = { data: { granola: { apiKey: 'grn_test123' } }, error: null }
    existingNoteResult = { data: null, error: null }
    contactResult = { data: null, error: null } // no matching contact

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        id: 'doc-2',
        title: 'Internal sync',
        attendees: [{ name: 'Unknown Person', email: 'nobody@nowhere.com' }],
        updated_at: '2026-07-10T13:00:00Z',
      }]),
    }))

    const result = await syncGranolaNotes(mockDb as never)

    expect(result.imported).toBe(1)
    expect(result.matched).toBe(0)
    expect(upsertCalls['granola_meeting_notes'][0]).toEqual(
      expect.objectContaining({ contact_id: null, activity_id: null }),
    )
    expect(upsertCalls['crm_activities']).toBeUndefined()
  })

  it('skips a document that was already synced and has not changed since', async () => {
    appSettingsResult = { data: { granola: { apiKey: 'grn_test123' } }, error: null }
    // Already synced, and its stored occurred_at is >= the incoming doc's
    // updated_at — nothing new to re-process.
    existingNoteResult = { data: { id: 'granola-doc-3', occurred_at: '2026-07-10T14:00:00Z', activity_id: null }, error: null }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 'doc-3', title: 'Repeat', updated_at: '2026-07-10T14:00:00Z' }]),
    }))

    const result = await syncGranolaNotes(mockDb as never)

    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)
    expect(result.updated).toBe(0)
    expect(upsertCalls['granola_meeting_notes']).toBeUndefined()
  })

  it('re-processes an already-synced document whose Granola note was regenerated since', async () => {
    appSettingsResult = { data: { granola: { apiKey: 'grn_test123' } }, error: null }
    // Previously synced with an older updated_at and no contact match yet.
    existingNoteResult = {
      data: { id: 'granola-doc-4', occurred_at: '2026-07-10T14:00:00Z', activity_id: null },
      error: null,
    }
    contactResult = { data: { id: 'contact-9', company_id: 'company-9' }, error: null }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        id: 'doc-4',
        title: 'Kickoff call (revised)',
        summary_markdown: 'Updated summary after Granola re-processed the recording.',
        attendees: [{ name: 'Jane Client', email: 'jane@client.com' }],
        updated_at: '2026-07-10T15:00:00Z', // newer than existing.occurred_at
      }]),
    }))

    const result = await syncGranolaNotes(mockDb as never)

    expect(result.imported).toBe(0)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.matched).toBe(1)

    expect(upsertCalls['granola_meeting_notes'][0]).toEqual(
      expect.objectContaining({
        granola_document_id: 'doc-4',
        summary: 'Updated summary after Granola re-processed the recording.',
        contact_id: 'contact-9',
      }),
    )
    // A newly-found contact match on an update should still log a real
    // CRM activity, not skip logging just because this doc was seen before.
    expect(upsertCalls['crm_activities'][0]).toEqual(
      expect.objectContaining({ id: 'act-granola-doc-4', contact_id: 'contact-9' }),
    )
  })
})
