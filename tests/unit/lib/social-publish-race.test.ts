import { describe, it, expect, vi, beforeEach } from 'vitest'

// AUDIT #592 — publishSocialPost() previously wrote status:'publishing'
// unconditionally, with no claim tying the write to the status snapshot
// just read. Two overlapping cron ticks (or a tick racing the manual
// Publish button) could both pass the stale-read check and both proceed to
// call publishToPlatform() for every platform, duplicate-posting live
// content. Asserts the fix: the write is conditioned on `status` still
// matching what was just read, and a lost race short-circuits before any
// platform publish attempt.

let selectResult: { data: Record<string, unknown> | null }
let claimResult: { data: Record<string, unknown> | null }
let finalUpdateResult: { data: Record<string, unknown> | null; error: unknown }
let lastClaimEqCalls: [string, unknown][]
let finalUpdatePayload: Record<string, unknown> | null

const mockDb = {
  from: vi.fn((table: string) => {
    if (table !== 'social_posts') return { select: vi.fn() }
    return {
      select: vi.fn(() => {
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.single = vi.fn(() => Promise.resolve(selectResult))
        return chain
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        const isClaim = payload.status === 'publishing'
        if (isClaim) {
          lastClaimEqCalls = []
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn((k: string, v: unknown) => { lastClaimEqCalls.push([k, v]); return chain })
          chain.select = vi.fn(() => chain)
          chain.maybeSingle = vi.fn(() => Promise.resolve(claimResult))
          return chain
        }
        finalUpdatePayload = payload
        const chain: Record<string, unknown> = {}
        chain.eq = vi.fn(() => chain)
        chain.select = vi.fn(() => chain)
        chain.single = vi.fn(() => Promise.resolve(finalUpdateResult))
        return chain
      }),
    }
  }),
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockDb,
}))

vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { publishSocialPost } from '@/lib/social-publish'

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    status: 'scheduled',
    approval_status: 'approved',
    platforms: ['unsupported_platform'],
    content: 'hello',
    hashtags: [],
    media_urls: [],
    link_url: null,
    ...overrides,
  }
}

describe('publishSocialPost — atomic claim (#592)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    finalUpdatePayload = null
  })

  it('conditions the claim write on the status just read', async () => {
    const row = postRow()
    selectResult = { data: row }
    claimResult = { data: { ...row, status: 'publishing' } }
    finalUpdateResult = { data: { ...row, status: 'failed' }, error: null }

    await publishSocialPost('post-1')

    expect(lastClaimEqCalls).toContainEqual(['status', 'scheduled'])
  })

  it('short-circuits with already_done and never attempts to publish when the claim is lost', async () => {
    const row = postRow()
    selectResult = { data: row }
    claimResult = { data: null } // another request already claimed it

    const result = await publishSocialPost('post-1')

    expect(result.reason).toBe('already_done')
    expect(result.anySucceeded).toBe(false)
    expect(finalUpdatePayload).toBeNull()
  })

  it('proceeds to attempt publishing (and records a failure) when the claim succeeds', async () => {
    const row = postRow()
    selectResult = { data: row }
    claimResult = { data: { ...row, status: 'publishing' } }
    finalUpdateResult = { data: { ...row, status: 'failed' }, error: null }

    const result = await publishSocialPost('post-1')

    expect(finalUpdatePayload).not.toBeNull()
    expect(finalUpdatePayload?.status).toBe('failed')
    expect(result.anySucceeded).toBe(false)
  })
})
