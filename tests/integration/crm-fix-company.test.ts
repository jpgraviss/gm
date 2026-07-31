import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #513/#532 — computeMatches() used to key companiesByName by
// name and keep only the last company inserted per name, so a contact
// whose company_name matched 2+ real companies sharing that name silently
// linked to whichever duplicate happened to be last in the unordered query
// result. The fix routes same-name collisions to `unmatched` with an
// `ambiguous` flag instead of guessing — this file is the regression test
// for that specific behavior, which had zero coverage.

let contactsResult: { data: unknown[]; error: unknown }
let companiesResult: { data: unknown[]; error: unknown }
let updateCalls: { contactId: string; companyId: unknown }[]
let updateShouldFailFor: Set<string>

function selectChain(result: { data: unknown[]; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.is = vi.fn(() => chain)
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'crm_contacts') {
      return {
        select: vi.fn(() => selectChain(contactsResult)),
        update: vi.fn((payload: { company_id: string }) => {
          const chain: Record<string, unknown> = {}
          let targetContactId = ''
          chain.eq = vi.fn((key: string, value: string) => {
            if (key === 'id') {
              targetContactId = value
              updateCalls.push({ contactId: value, companyId: payload.company_id })
            }
            return chain
          })
          chain.is = vi.fn(() => chain)
          chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
            const result = updateShouldFailFor.has(targetContactId)
              ? { error: { message: 'update failed' } }
              : { error: null }
            return Promise.resolve(result).then(resolve, reject)
          }
          return chain
        }),
      }
    }
    if (table === 'crm_companies') {
      return { select: vi.fn(() => selectChain(companiesResult)) }
    }
    return selectChain({ data: [], error: null })
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

import { GET, POST } from '@/app/api/crm/contacts/fix-company/route'

function getReq() {
  return GET(new NextRequest(new URL('http://localhost/api/crm/contacts/fix-company')))
}
function postReq() {
  return POST(new NextRequest(new URL('http://localhost/api/crm/contacts/fix-company'), { method: 'POST' }))
}

describe('GET /api/crm/contacts/fix-company', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls = []
    updateShouldFailFor = new Set()
  })

  it('matches a contact whose company_name matches exactly one company, case-insensitively', async () => {
    contactsResult = { data: [{ id: 'c-1', full_name: 'Jane Client', company_name: 'acme corp' }], error: null }
    companiesResult = { data: [{ id: 'co-1', name: 'Acme Corp' }], error: null }

    const json = await (await getReq()).json()

    expect(json.matches).toEqual([
      { contactId: 'c-1', contactName: 'Jane Client', companyNameOnFile: 'acme corp', matchedCompanyId: 'co-1', matchedCompanyName: 'Acme Corp' },
    ])
    expect(json.unmatched).toEqual([])
  })

  it('routes a same-name company collision to unmatched with ambiguous:true instead of silently picking one', async () => {
    contactsResult = { data: [{ id: 'c-1', full_name: 'Jane Client', company_name: 'Acme Corp' }], error: null }
    companiesResult = {
      data: [
        { id: 'co-1', name: 'Acme Corp' },
        { id: 'co-2', name: 'Acme Corp' },
      ],
      error: null,
    }

    const json = await (await getReq()).json()

    expect(json.matches).toEqual([])
    expect(json.unmatched).toEqual([
      { contactId: 'c-1', contactName: 'Jane Client', companyNameOnFile: 'Acme Corp', ambiguous: true },
    ])
  })

  it('reports a contact with no matching company as unmatched, not ambiguous', async () => {
    contactsResult = { data: [{ id: 'c-1', full_name: 'Jane Client', company_name: 'Nobody Inc' }], error: null }
    companiesResult = { data: [{ id: 'co-1', name: 'Acme Corp' }], error: null }

    const json = await (await getReq()).json()

    expect(json.matches).toEqual([])
    expect(json.unmatched).toEqual([
      { contactId: 'c-1', contactName: 'Jane Client', companyNameOnFile: 'Nobody Inc', ambiguous: false },
    ])
  })
})

describe('POST /api/crm/contacts/fix-company', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls = []
    updateShouldFailFor = new Set()
  })

  it('writes company_id only for unambiguous matches, leaving ambiguous/unmatched contacts untouched', async () => {
    contactsResult = {
      data: [
        { id: 'c-1', full_name: 'Jane Client', company_name: 'Acme Corp' },
        { id: 'c-2', full_name: 'Sam Duplicate', company_name: 'Dupe Co' },
        { id: 'c-3', full_name: 'Alex Unknown', company_name: 'Nobody Inc' },
      ],
      error: null,
    }
    companiesResult = {
      data: [
        { id: 'co-1', name: 'Acme Corp' },
        { id: 'co-2', name: 'Dupe Co' },
        { id: 'co-3', name: 'Dupe Co' },
      ],
      error: null,
    }

    const json = await (await postReq()).json()

    expect(json.updated).toBe(1)
    expect(json.failures).toEqual([])
    expect(json.unmatched).toEqual([
      { contactId: 'c-2', contactName: 'Sam Duplicate', companyNameOnFile: 'Dupe Co', ambiguous: true },
      { contactId: 'c-3', contactName: 'Alex Unknown', companyNameOnFile: 'Nobody Inc', ambiguous: false },
    ])
    expect(updateCalls).toEqual([{ contactId: 'c-1', companyId: 'co-1' }])
  })

  it('reports a failed write in failures instead of silently counting it as updated', async () => {
    contactsResult = { data: [{ id: 'c-1', full_name: 'Jane Client', company_name: 'Acme Corp' }], error: null }
    companiesResult = { data: [{ id: 'co-1', name: 'Acme Corp' }], error: null }
    updateShouldFailFor = new Set(['c-1'])

    const json = await (await postReq()).json()

    expect(json.updated).toBe(0)
    expect(json.failures).toEqual([{ contactId: 'c-1', error: 'update failed' }])
  })
})
