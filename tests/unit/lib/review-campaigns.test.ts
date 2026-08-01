import { describe, it, expect } from 'vitest'
import { resolveCampaignAudience } from '@/lib/review-campaigns'

// AUDIT #662 — resolveCampaignAudience() never consulted
// sequence_suppression_list, unlike the sibling mass-send paths that
// share the same contact pool (lib/broadcasts.ts, sequences/[id]/enroll).
// A contact who unsubscribed/hard-bounced out of marketing could still
// receive an automated review-request campaign email.

function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'lte', 'gte', 'not', 'in']
  for (const m of methods) chain[m] = () => chain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => resolve({ data, error })
  return chain
}

function makeDb(opts: {
  companies: Array<{ id: string; name: string; created_date: string }>
  contacts: Array<{ company_id: string; full_name: string; emails: string[]; is_primary: boolean }>
  suppressed: Array<{ email: string }>
}) {
  return {
    from: (table: string) => {
      if (table === 'crm_companies') return makeChain(opts.companies)
      if (table === 'crm_contacts') return makeChain(opts.contacts)
      if (table === 'sequence_suppression_list') return makeChain(opts.suppressed)
      if (table === 'deals') return makeChain([])
      return makeChain([])
    },
  }
}

describe('resolveCampaignAudience — suppression list (#662)', () => {
  it('excludes a contact whose email is on the suppression list', async () => {
    const db = makeDb({
      companies: [{ id: 'co-1', name: 'Acme', created_date: '2020-01-01' }],
      contacts: [{ company_id: 'co-1', full_name: 'Jane Doe', emails: ['jane@acme.com'], is_primary: true }],
      suppressed: [{ email: 'jane@acme.com' }],
    })
    const recipients = await resolveCampaignAudience(db, 'All Clients')
    expect(recipients).toHaveLength(0)
  })

  it('includes a contact whose email is not suppressed', async () => {
    const db = makeDb({
      companies: [{ id: 'co-1', name: 'Acme', created_date: '2020-01-01' }],
      contacts: [{ company_id: 'co-1', full_name: 'Jane Doe', emails: ['jane@acme.com'], is_primary: true }],
      suppressed: [{ email: 'someone-else@example.com' }],
    })
    const recipients = await resolveCampaignAudience(db, 'All Clients')
    expect(recipients).toHaveLength(1)
    expect(recipients[0].email).toBe('jane@acme.com')
  })

  it('matches suppression case-insensitively', async () => {
    const db = makeDb({
      companies: [{ id: 'co-1', name: 'Acme', created_date: '2020-01-01' }],
      contacts: [{ company_id: 'co-1', full_name: 'Jane Doe', emails: ['Jane@Acme.com'], is_primary: true }],
      suppressed: [{ email: 'jane@acme.com' }],
    })
    const recipients = await resolveCampaignAudience(db, 'All Clients')
    expect(recipients).toHaveLength(0)
  })
})
