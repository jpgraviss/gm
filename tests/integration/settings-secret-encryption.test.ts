import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Every integration secret the settings route knows about must be encrypted
 * on the way in and decrypted on the way out.
 *
 * AUDIT #768 — PATCH used to carry one hand-written branch per integration
 * while GET already looped a single map. Both directions now iterate that
 * map, and this test is what makes the loop meaningful: it round-trips
 * *every* secret field, so an integration that drops out of the loop fails
 * here rather than silently storing a plaintext key.
 *
 * Silently is the operative word. `decrypt()` deliberately passes through
 * values that were never encrypted (so legacy rows keep working), which
 * means a plaintext-stored key would keep functioning perfectly — the only
 * symptom is the key sitting readable in the database.
 */

let storedRow: Record<string, unknown> = {}
let upsertPayload: Record<string, unknown> | null = null

const mockDb = {
  from: vi.fn(() => {
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: storedRow, error: null }))
    chain.single = vi.fn(() => Promise.resolve({ data: { id: 'global', ...upsertPayload }, error: null }))
    chain.upsert = vi.fn((payload: Record<string, unknown>) => {
      upsertPayload = payload
      return chain
    })
    return chain
  }),
}

vi.mock('@/lib/supabase', () => ({ createServiceClient: () => mockDb }))
vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(() => Promise.resolve(null)),
  getAuthenticatedEmail: vi.fn(() => Promise.resolve('jamie@gravissmarketing.com')),
}))
vi.mock('@/lib/rbac', () => ({
  getAuthUser: vi.fn(() => Promise.resolve({ name: 'Jamie', email: 'jamie@gravissmarketing.com' })),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { GET, PATCH } from '@/app/api/settings/route'

/** Every column → secret fields the route encrypts. Mirrors the route's map. */
const SECRETS: Record<string, string[]> = {
  hubspot: ['apiKey'],
  mercury: ['apiKey'],
  serpapi: ['apiKey'],
  maverick: ['apiKey'],
  apollo: ['apiKey'],
  granola: ['apiKey'],
  stripe: ['secretKey', 'webhookSecret'],
  resend: ['apiKey'],
}

function patchBody(body: unknown) {
  return PATCH(new NextRequest(new URL('http://localhost/api/settings'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  }))
}

describe('settings integration secrets are encrypted at rest', () => {
  beforeEach(() => {
    storedRow = {}
    upsertPayload = null
  })

  it('encrypts every known secret field on PATCH', async () => {
    const body: Record<string, Record<string, string>> = {}
    for (const [column, fields] of Object.entries(SECRETS)) {
      body[column] = Object.fromEntries(fields.map(f => [f, `plaintext-${column}-${f}`]))
    }

    await patchBody(body)
    expect(upsertPayload).not.toBeNull()

    const leaked: string[] = []
    for (const [column, fields] of Object.entries(SECRETS)) {
      const stored = upsertPayload![column] as Record<string, string> | undefined
      for (const field of fields) {
        const plaintext = `plaintext-${column}-${field}`
        if (!stored) { leaked.push(`${column} was not stored at all`); continue }
        if (stored[field] === plaintext) leaked.push(`${column}.${field} stored in plaintext`)
      }
    }
    expect(leaked).toEqual([])
  })

  it('gives the plaintext back on GET, so the settings UI still works', async () => {
    const body: Record<string, Record<string, string>> = {
      stripe: { secretKey: 'sk_live_roundtrip', webhookSecret: 'whsec_roundtrip' },
    }
    await patchBody(body)

    storedRow = { id: 'global', ...upsertPayload }
    const res = await GET(new NextRequest(new URL('http://localhost/api/settings')))
    const json = await res.json()

    expect(json.stripe.secretKey).toBe('sk_live_roundtrip')
    expect(json.stripe.webhookSecret).toBe('whsec_roundtrip')
  })

  it('never caches a response carrying decrypted keys', async () => {
    const res = await GET(new NextRequest(new URL('http://localhost/api/settings')))
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
