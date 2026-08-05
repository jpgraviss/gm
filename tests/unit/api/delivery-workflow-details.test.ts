import { describe, it, expect } from 'vitest'
import { mapWorkflow } from '@/app/api/delivery/workflow/route'

// AUDIT #693 — mapWorkflow() never emitted a `details` object, so the client
// Delivery Timeline's per-step panel rendered nothing for every step of every
// workflow. These cover the real data sources it now surfaces, and — just as
// importantly — that it stays silent where no real data exists.

const baseRow = {
  id: 'wf-1',
  company_id: 'co-1',
  company_name: 'Acme Co',
  service_type: 'Website',
  step_01_agreement: 'Completed',
  step_02_invoice: 'Pending',
  step_03_welcome: 'Pending',
  step_04_portal: 'Pending',
  step_05_strategy_call: 'Pending',
  step_06_usage_guide: 'Pending',
  step_07_fulfillment: 'Pending',
  step_08_monthly_report: 'Pending',
  step_07_deliverables: [],
  created_at: '2026-01-01T00:00:00Z',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const detailsFor = (result: any, step: number) => result.steps[step - 1].details

describe('delivery workflow step details', () => {
  it('emits no details for steps with no underlying data', () => {
    const result = mapWorkflow({ ...baseRow })
    for (let step = 1; step <= 8; step++) {
      expect(detailsFor(result, step)).toBeUndefined()
    }
  })

  it('normalizes staff-added deliverables from fileUrl to the url key', () => {
    const result = mapWorkflow({
      ...baseRow,
      step_07_deliverables: [
        { id: 'd1', name: 'Homepage Mockup', type: 'Design', fileUrl: 'https://files.example.com/mock.pdf' },
      ],
    })
    expect(detailsFor(result, 7)).toEqual({
      deliverables: [{ name: 'Homepage Mockup', url: 'https://files.example.com/mock.pdf' }],
    })
  })

  it('keeps deliverables that were added without a file link', () => {
    const result = mapWorkflow({
      ...baseRow,
      step_07_deliverables: [
        { id: 'd1', name: 'Brand Guide', type: 'Doc', fileUrl: null },
        { id: 'd2', name: '   ', type: 'Doc', fileUrl: 'https://files.example.com/x.pdf' },
      ],
    })
    // The unnamed entry is dropped; the link-less one survives without a url.
    expect(detailsFor(result, 7)).toEqual({ deliverables: [{ name: 'Brand Guide' }] })
  })

  it('tolerates a non-array deliverables column', () => {
    const result = mapWorkflow({ ...baseRow, step_07_deliverables: null })
    expect(detailsFor(result, 7)).toBeUndefined()
  })

  it('surfaces step metadata dates the workflow row genuinely stores', () => {
    const result = mapWorkflow({
      ...baseRow,
      step_03_email_sent_at: '2026-02-01T10:00:00Z',
      step_04_first_login: '2026-02-03T10:00:00Z',
      step_05_notes: 'Discussed Q1 priorities.',
      step_06_email_sent_at: '2026-02-05T10:00:00Z',
      step_08_last_sent_at: '2026-03-05T10:00:00Z',
    })
    expect(detailsFor(result, 3)).toEqual({ welcomeEmailDate: '2026-02-01T10:00:00Z' })
    expect(detailsFor(result, 4)).toEqual({ firstLoginDate: '2026-02-03T10:00:00Z' })
    expect(detailsFor(result, 5)).toEqual({ meetingNotes: 'Discussed Q1 priorities.' })
    expect(detailsFor(result, 6)).toEqual({ usageGuideSentDate: '2026-02-05T10:00:00Z' })
    expect(detailsFor(result, 8)).toEqual({ lastReportSentDate: '2026-03-05T10:00:00Z' })
  })

  it('reports a signed contract and its invoice from the real records', () => {
    const result = mapWorkflow({ ...baseRow }, {
      contract: { status: 'Active', client_signed: '2026-01-15' },
      invoice: { amount: '2500.00', status: 'Paid' },
      portalClient: { access: 'Active' },
    })
    expect(detailsFor(result, 1)).toEqual({ signatureStatus: 'Signed' })
    expect(detailsFor(result, 2)).toEqual({ invoiceAmount: 2500, paymentStatus: 'Paid' })
    expect(detailsFor(result, 4)).toEqual({ portalAccess: 'Active' })
  })

  it('falls back to the contract status when it is not signed yet', () => {
    const result = mapWorkflow({ ...baseRow }, {
      contract: { status: 'Sent', client_signed: null },
      invoice: { amount: null, status: null },
    })
    expect(detailsFor(result, 1)).toEqual({ signatureStatus: 'Sent' })
    expect(detailsFor(result, 2)).toBeUndefined()
  })

  it('leaves fields with no data source in this app unpopulated', () => {
    const result = mapWorkflow({ ...baseRow }, {
      contract: { status: 'Active', client_signed: '2026-01-15' },
      invoice: { amount: 100, status: 'Paid' },
    })
    // No document URLs, booking link, help articles, report artifact or
    // metrics preview — nothing stores them, so nothing is invented.
    expect(detailsFor(result, 1)).not.toHaveProperty('contractUrl')
    expect(detailsFor(result, 2)).not.toHaveProperty('invoiceUrl')
    expect(detailsFor(result, 5)).toBeUndefined()
    expect(detailsFor(result, 6)).toBeUndefined()
    expect(detailsFor(result, 8)).toBeUndefined()
  })
})
