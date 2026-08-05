import { describe, it, expect, beforeEach, vi } from 'vitest'

// Nothing in the app could send an invoice: the `Sent` status existed, the
// billing KPI counted it, the cron aged `Sent → Overdue`, and the automations
// engine had an `Invoice Overdue` trigger — an entire AR pipeline whose first
// step had no implementation. These tests pin the properties that make
// sending safe: never send a paid/cancelled invoice, never mark an invoice
// Sent that no client received, and never walk an Overdue invoice backwards.

type EmailArgs = { to: string; subject: string; html: string }
type EmailResult = { success: boolean; id?: string; error?: string }

const sendEmail = vi.fn<(o: EmailArgs) => Promise<EmailResult>>(async () => ({ success: true, id: 'em-1' }))
const createInvoiceCheckoutSession = vi.fn(async () => ({ url: 'https://pay.example/abc', sessionId: 'cs_1' }))
let stripeKey: string | null = 'sk_test'

vi.mock('@/lib/email', () => ({ sendEmail: (o: EmailArgs) => sendEmail(o) }))
vi.mock('@/lib/email-template', () => ({ wrapBrandedEmail: async (b: string) => `<html>${b}</html>` }))
vi.mock('@/lib/activity-log', () => ({ logActivity: vi.fn() }))
vi.mock('@/lib/settings', () => ({
  getSettings: async () => ({
    company: { name: 'Graviss Marketing' },
    branding: { primaryColor: '#015035' },
  }),
}))
vi.mock('@/lib/stripe', () => ({
  getStripeSecretKey: async () => stripeKey,
  createInvoiceCheckoutSession: (...a: unknown[]) => createInvoiceCheckoutSession(...(a as [])),
}))

interface Row { [k: string]: unknown }

let invoice: Row | null
let portalClients: Row[]
let statusUpdates: Row[]
let claimWins: boolean

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table === 'portal_clients') {
        return { select: () => ({ limit: async () => ({ data: portalClients, error: null }) }) }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: invoice, error: null }) }) }),
        update: (payload: Row) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => {
                  if (!claimWins) return { data: null, error: null }
                  statusUpdates.push(payload)
                  return { data: { id: 'inv-1' }, error: null }
                },
              }),
            }),
          }),
        }),
      }
    },
  }),
}))

import { sendInvoiceEmail } from '@/lib/invoice-send'

function makeInvoice(over: Row = {}): Row {
  return {
    id: 'inv-1', company: 'ADCO Inc', company_id: 'co-1',
    amount: 2500, status: 'Pending', due_date: '2026-09-04',
    service_type: 'SEO', ...over,
  }
}

beforeEach(() => {
  invoice = makeInvoice()
  portalClients = [{ email: 'ap@adco.test', contact: 'Dana', company: 'ADCO Inc', company_id: 'co-1', access: 'Active' }]
  statusUpdates = []
  claimWins = true
  stripeKey = 'sk_test'
  sendEmail.mockClear()
  sendEmail.mockResolvedValue({ success: true, id: 'em-1' })
  createInvoiceCheckoutSession.mockClear()
  createInvoiceCheckoutSession.mockResolvedValue({ url: 'https://pay.example/abc', sessionId: 'cs_1' })
})

describe('sendInvoiceEmail — refusals', () => {
  it('refuses a paid invoice', async () => {
    invoice = makeInvoice({ status: 'Paid' })
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a cancelled invoice', async () => {
    invoice = makeInvoice({ status: 'Cancelled' })
    expect((await sendInvoiceEmail('inv-1')).ok).toBe(false)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a $0 invoice', async () => {
    invoice = makeInvoice({ amount: 0 })
    expect((await sendInvoiceEmail('inv-1')).ok).toBe(false)
  })

  it('names the missing billing contact instead of failing vaguely', async () => {
    portalClients = []
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('ADCO Inc')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns not-found for an unknown invoice', async () => {
    invoice = null
    expect((await sendInvoiceEmail('nope')).ok).toBe(false)
  })
})

describe('sendInvoiceEmail — recipient resolution', () => {
  it('prefers the company_id FK over the name', async () => {
    portalClients = [
      { email: 'wrong@other.test', contact: 'X', company: 'ADCO Inc', company_id: 'co-999', access: 'Active' },
      { email: 'right@adco.test', contact: 'Dana', company: 'Totally Different', company_id: 'co-1', access: 'Active' },
    ]
    const res = await sendInvoiceEmail('inv-1')
    expect(res.recipient).toBe('right@adco.test')
  })

  it('falls back to the company name when the invoice has no FK', async () => {
    invoice = makeInvoice({ company_id: null })
    portalClients = [{ email: 'ap@adco.test', contact: 'Dana', company: 'adco inc', company_id: null, access: 'Active' }]
    expect((await sendInvoiceEmail('inv-1')).recipient).toBe('ap@adco.test')
  })

  it('prefers an active contact when a company has several', async () => {
    portalClients = [
      { email: 'old@adco.test', contact: 'Old', company: 'ADCO Inc', company_id: 'co-1', access: 'Disabled' },
      { email: 'ap@adco.test', contact: 'Dana', company: 'ADCO Inc', company_id: 'co-1', access: 'Active' },
    ]
    expect((await sendInvoiceEmail('inv-1')).recipient).toBe('ap@adco.test')
  })
})

describe('sendInvoiceEmail — sending', () => {
  it('sends with a Stripe pay link and advances Pending → Sent', async () => {
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(true)
    expect(res.payLink).toBe('https://pay.example/abc')
    expect(statusUpdates).toEqual([{ status: 'Sent' }])
    const html = sendEmail.mock.calls[0][0].html
    expect(html).toContain('https://pay.example/abc')
  })

  it('still sends when Stripe is not connected', async () => {
    stripeKey = null
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(true)
    expect(res.payLink).toBeNull()
    expect(sendEmail).toHaveBeenCalled()
  })

  it('still sends when the Stripe call itself fails', async () => {
    createInvoiceCheckoutSession.mockRejectedValueOnce(new Error('stripe down'))
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(true)
    expect(res.payLink).toBeNull()
  })

  it('leaves the invoice Pending when the email fails, so it can be retried', async () => {
    sendEmail.mockResolvedValueOnce({ success: false, error: 'mailbox full' })
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(false)
    // The critical property: never mark Sent an invoice no client received.
    expect(statusUpdates).toEqual([])
  })

  it('does not walk an Overdue invoice back to Sent on a re-send', async () => {
    // The claim is scoped `.eq('status','Pending')`, so a re-send of an
    // Overdue invoice mails the reminder but leaves the aging intact.
    invoice = makeInvoice({ status: 'Overdue' })
    claimWins = false
    const res = await sendInvoiceEmail('inv-1')
    expect(res.ok).toBe(true)
    expect(res.statusUnchanged).toBe(true)
    expect(statusUpdates).toEqual([])
    expect(sendEmail).toHaveBeenCalled()
  })

  it('escapes client-controlled text in the email body', async () => {
    portalClients = [{
      email: 'ap@adco.test', contact: '<img src=x onerror=alert(1)>',
      company: 'ADCO Inc', company_id: 'co-1', access: 'Active',
    }]
    await sendInvoiceEmail('inv-1')
    const html = sendEmail.mock.calls[0][0].html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
})
