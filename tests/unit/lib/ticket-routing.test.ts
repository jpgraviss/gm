import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUDIT.md #518/#532 — lib/ticket-routing.ts is the shared routing logic
// behind every ticket-creation path (staff/portal POST, inbound-email
// creation) and had zero test coverage despite being new, security/business
// -relevant code (who a ticket silently lands on). This file closes that gap.

type EqFilter = [string, unknown]

function createChain(resolver: (filters: EqFilter[]) => { data: unknown; error: unknown }) {
  const filters: EqFilter[] = []
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((k: string, v: unknown) => {
    filters.push([k, v])
    return chain
  })
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve().then(() => resolver(filters)))
  return chain
}

let teamMembersByUnit: Record<string, { name: string } | null>
let teamMemberIdByName: Record<string, string | null>
let dealRep: { assigned_rep: string } | null

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === 'team_members') {
      return createChain((filters) => {
        const nameFilter = filters.find(([k]) => k === 'name')
        if (nameFilter) {
          const id = teamMemberIdByName[nameFilter[1] as string]
          return { data: id ? { id } : null, error: null }
        }
        const unitFilter = filters.find(([k]) => k === 'unit')
        const unit = unitFilter ? (unitFilter[1] as string) : undefined
        const member = unit ? teamMembersByUnit[unit] : undefined
        return { data: member ?? null, error: null }
      })
    }
    if (table === 'deals') {
      return createChain(() => ({ data: dealRep, error: null }))
    }
    return createChain(() => ({ data: null, error: null }))
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/push-notifications', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notification-preferences', () => ({
  shouldSendPushForEvent: vi.fn().mockResolvedValue(true),
}))

import { applyRoutingRules, notifyRoutedAssignee } from '@/lib/ticket-routing'
import { sendPushNotification } from '@/lib/push-notifications'
import { shouldSendPushForEvent } from '@/lib/notification-preferences'
import { createServiceClient } from '@/lib/supabase'

const db = createServiceClient()

describe('applyRoutingRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    teamMembersByUnit = {}
    teamMemberIdByName = {}
    dealRep = null
  })

  it('escalates an Urgent ticket to an active Leadership/Admin member ahead of any deal rep', async () => {
    teamMembersByUnit['Leadership/Admin'] = { name: 'Casey Lead' }
    dealRep = { assigned_rep: 'Some Rep' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Urgent', 'SEO / AEO')

    expect(result).toEqual({ name: 'Casey Lead', escalated: true })
  })

  it('escalates a High priority ticket the same as Urgent', async () => {
    teamMembersByUnit['Leadership/Admin'] = { name: 'Casey Lead' }

    const result = await applyRoutingRules(db, 'Acme Co', 'High', 'Sales Training')

    expect(result).toEqual({ name: 'Casey Lead', escalated: true })
  })

  it('falls through to the deal-assigned rep when an Urgent/High ticket has no active Leadership/Admin member', async () => {
    dealRep = { assigned_rep: 'Jamie Rep' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Urgent', 'SEO / AEO')

    expect(result).toEqual({ name: 'Jamie Rep', escalated: false })
  })

  it('routes a non-urgent ticket to the company\'s most recently assigned deal rep before the service-type unit', async () => {
    dealRep = { assigned_rep: 'Jamie Rep' }
    teamMembersByUnit['Delivery/Operations'] = { name: 'Ops Person' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'SEO / AEO')

    expect(result).toEqual({ name: 'Jamie Rep', escalated: false })
  })

  it('falls back to the service-type unit when the company has no deal rep', async () => {
    teamMembersByUnit['Delivery/Operations'] = { name: 'Ops Person' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'Website Build')

    expect(result).toEqual({ name: 'Ops Person', escalated: false })
  })

  it('maps a Sales-lane service type to the Sales unit', async () => {
    teamMembersByUnit['Sales'] = { name: 'Sales Person' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'Fractional Sales Lead / CRO')

    expect(result).toEqual({ name: 'Sales Person', escalated: false })
  })

  it('maps a General service type to the Sales unit', async () => {
    teamMembersByUnit['Sales'] = { name: 'Sales Person' }

    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'General')

    expect(result).toEqual({ name: 'Sales Person', escalated: false })
  })

  it('returns null when nothing matches — no leadership, no deal rep, and no unit member', async () => {
    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'Website Build')

    expect(result).toBeNull()
  })

  it('returns null for an unrecognized service type with no deal rep', async () => {
    const result = await applyRoutingRules(db, 'Acme Co', 'Normal', 'Unrecognized Type')

    expect(result).toBeNull()
  })
})

describe('notifyRoutedAssignee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    teamMembersByUnit = {}
    teamMemberIdByName = {}
    dealRep = null
  })

  it('does nothing when routing is null', async () => {
    await notifyRoutedAssignee(db, null, 'Subject', 'Acme Co')

    expect(sendPushNotification).not.toHaveBeenCalled()
  })

  it('sends nothing when the routed name has no matching active team member', async () => {
    await notifyRoutedAssignee(db, { name: 'Ghost Person', escalated: false }, 'Subject', 'Acme Co')

    expect(sendPushNotification).not.toHaveBeenCalled()
  })

  it('sends nothing when the caller\'s notification preferences say not to', async () => {
    teamMemberIdByName['Ops Person'] = 'tm-1'
    vi.mocked(shouldSendPushForEvent).mockResolvedValueOnce(false)

    await notifyRoutedAssignee(db, { name: 'Ops Person', escalated: false }, 'Subject', 'Acme Co')

    expect(sendPushNotification).not.toHaveBeenCalled()
  })

  it('titles a plain routing assignment "New ticket assigned to you"', async () => {
    teamMemberIdByName['Ops Person'] = 'tm-1'

    await notifyRoutedAssignee(db, { name: 'Ops Person', escalated: false }, 'Site is down', 'Acme Co')

    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tm-1',
        title: 'New ticket assigned to you',
        body: 'Site is down — Acme Co',
        url: '/tickets',
      }),
    )
  })

  it('titles an escalated assignment "Urgent ticket escalated to you"', async () => {
    teamMemberIdByName['Casey Lead'] = 'tm-2'

    await notifyRoutedAssignee(db, { name: 'Casey Lead', escalated: true }, 'Site is down', 'Acme Co')

    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tm-2', title: 'Urgent ticket escalated to you' }),
    )
  })

  it('never throws when the push send itself rejects — a failed push must not fail ticket creation', async () => {
    teamMemberIdByName['Ops Person'] = 'tm-1'
    vi.mocked(sendPushNotification).mockReturnValueOnce(Promise.reject(new Error('push service down')))

    await expect(
      notifyRoutedAssignee(db, { name: 'Ops Person', escalated: false }, 'Subject', 'Acme Co'),
    ).resolves.toBeUndefined()
  })
})
