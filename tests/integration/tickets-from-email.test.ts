import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #518/#532 — inbound-email tickets used to insert directly with
// assigned_to hardcoded to '', never calling applyRoutingRules(), and no
// test file existed for this route at all despite it being a real,
// cron-driven ticket-creation path. This file asserts the actual wiring
// claim: that an email-created ticket goes through the same routing +
// notification calls a staff/portal-created ticket does.

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'not', 'in', 'eq', 'update', 'delete', 'order', 'limit']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

let staffWithGmailResult: { data: unknown[] }
let processedEmailsSelectResult: { data: unknown[] }
let contactsResult: { data: unknown[] }
let companiesResult: { data: unknown[] }
let ticketInsertResult: { error: unknown }
let lastTicketInsertPayload: Record<string, unknown> | null
let processedEmailsDeleteCalled: boolean

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'team_members') return makeChain(staffWithGmailResult)
    if (table === 'crm_contacts') return makeChain(contactsResult)
    if (table === 'crm_companies') return makeChain(companiesResult)
    if (table === 'processed_emails') {
      const chain = makeChain(processedEmailsSelectResult)
      chain.insert = vi.fn(() => makeChain({ error: null }))
      chain.delete = vi.fn(() => {
        processedEmailsDeleteCalled = true
        return makeChain({ error: null })
      })
      return chain
    }
    if (table === 'tickets') {
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          lastTicketInsertPayload = payload
          return makeChain(ticketInsertResult)
        }),
      }
    }
    return makeChain({ data: [], error: null })
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null) }))

vi.mock('@/lib/ticket-routing', () => ({
  applyRoutingRules: vi.fn().mockResolvedValue({ name: 'Ops Person', escalated: false }),
  notifyRoutedAssignee: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '@/app/api/tickets/from-email/route'
import { applyRoutingRules, notifyRoutedAssignee } from '@/lib/ticket-routing'

function gmailMessage(fromEmail: string, fromName: string, subject: string, body: string) {
  return {
    payload: {
      headers: [
        { name: 'From', value: `${fromName} <${fromEmail}>` },
        { name: 'Subject', value: subject },
        { name: 'Date', value: 'Wed, 15 Jan 2026 10:00:00 -0500' },
        { name: 'Message-ID', value: '<abc123@mail.example.com>' },
      ],
      mimeType: 'text/plain',
      body: { data: Buffer.from(body, 'utf-8').toString('base64url') },
    },
  }
}

function stubGmail(message: ReturnType<typeof gmailMessage>) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/messages?maxResults=20')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ messages: [{ id: 'msg-1' }] }) })
    }
    if (url.includes('/messages/msg-1?format=full')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(message) })
    }
    return Promise.resolve({ ok: false })
  })
}

function postFromEmail() {
  const req = new NextRequest(new URL('http://localhost/api/tickets/from-email'), { method: 'POST' })
  return POST(req)
}

describe('POST /api/tickets/from-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastTicketInsertPayload = null
    processedEmailsDeleteCalled = false
    staffWithGmailResult = {
      data: [{ id: 'tm-1', email: 'rep@gravissmarketing.com', gmail_access_token: 'tok-abc', gmail_token_expires_at: new Date(Date.now() + 3_600_000).toISOString() }],
    }
    processedEmailsSelectResult = { data: [] }
    contactsResult = { data: [{ emails: ['jane@acmeco.com'], company_name: 'Acme Corp', full_name: 'Jane Client' }] }
    companiesResult = { data: [] }
    ticketInsertResult = { error: null }
  })

  it('routes an email-created ticket through applyRoutingRules and assigns it, instead of leaving assigned_to hardcoded empty', async () => {
    stubGmail(gmailMessage('jane@acmeco.com', 'Jane Client', 'Need help with SEO', 'Please help with our SEO ranking.'))

    const res = await postFromEmail()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ created: 1, skipped: 0, accountsChecked: 1, errors: [] })
    expect(applyRoutingRules).toHaveBeenCalledWith(mockDb, 'Acme Corp', 'Medium', 'General')
    expect(lastTicketInsertPayload?.assigned_to).toBe('Ops Person')
    expect(lastTicketInsertPayload?.company).toBe('Acme Corp')
  })

  it('notifies the routed assignee the same way a staff/portal-created ticket does', async () => {
    stubGmail(gmailMessage('jane@acmeco.com', 'Jane Client', 'Need help with SEO', 'Please help with our SEO ranking.'))

    await postFromEmail()

    expect(notifyRoutedAssignee).toHaveBeenCalledWith(
      mockDb,
      { name: 'Ops Person', escalated: false },
      'Need help with SEO',
      'Acme Corp',
    )
  })

  it('skips internal @gravissmarketing.com senders without ever routing or creating a ticket', async () => {
    stubGmail(gmailMessage('team@gravissmarketing.com', 'Internal Team', 'FYI', 'Internal note.'))

    const res = await postFromEmail()
    const json = await res.json()

    expect(json).toEqual({ created: 0, skipped: 1, accountsChecked: 1, errors: [] })
    expect(applyRoutingRules).not.toHaveBeenCalled()
    expect(lastTicketInsertPayload).toBeNull()
  })

  it('releases the processed_emails claim and does not notify anyone when the ticket insert itself fails', async () => {
    stubGmail(gmailMessage('jane@acmeco.com', 'Jane Client', 'Need help with SEO', 'Please help with our SEO ranking.'))
    ticketInsertResult = { error: { message: 'insert failed' } }

    const res = await postFromEmail()
    const json = await res.json()

    expect(json).toEqual({ created: 0, skipped: 1, accountsChecked: 1, errors: [] })
    expect(processedEmailsDeleteCalled).toBe(true)
    expect(notifyRoutedAssignee).not.toHaveBeenCalled()
  })
})
