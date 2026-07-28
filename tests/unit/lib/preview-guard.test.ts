import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// AUDIT.md #506 — "View as Client" preview mode had zero protection against
// triggering real writes. These two functions are the server- and
// client-side halves of the fix; see lib/portal-auth.ts and
// lib/useClientCompany.tsx for the full writeup.

vi.mock('@/lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ getAuthenticatedEmail: vi.fn() }))

import { blockIfPreview } from '@/lib/portal-auth'
import { previewFetch, PREVIEW_HEADER } from '@/lib/useClientCompany'

describe('blockIfPreview', () => {
  it('returns null (allow) when the preview header is absent', () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-1'), { method: 'PATCH' })
    expect(blockIfPreview(req)).toBeNull()
  })

  it('returns a 403 when the preview header is set', async () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-1'), {
      method: 'PATCH',
      headers: { [PREVIEW_HEADER]: 'true' },
    })
    const res = blockIfPreview(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toMatch(/preview/i)
  })

  it('ignores an unrelated truthy header value', () => {
    const req = new NextRequest(new URL('http://localhost/api/contracts/c-1'), {
      method: 'PATCH',
      headers: { [PREVIEW_HEADER]: 'yes' },
    })
    expect(blockIfPreview(req)).toBeNull()
  })
})

describe('previewFetch', () => {
  it('blocks a mutating request without hitting the network when isPreview is true', async () => {
    const realFetch = vi.spyOn(globalThis, 'fetch')
    const res = await previewFetch(true, '/api/contracts/c-1', { method: 'PATCH', body: '{}' })
    expect(res.status).toBe(403)
    expect(realFetch).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error).toMatch(/preview/i)
    realFetch.mockRestore()
  })

  it('allows a GET request through even when isPreview is true, and tags it with the preview header', async () => {
    const realFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    await previewFetch(true, '/api/contracts/c-1')
    expect(realFetch).toHaveBeenCalledTimes(1)
    const [, init] = realFetch.mock.calls[0]
    const headers = new Headers((init as RequestInit | undefined)?.headers)
    expect(headers.get(PREVIEW_HEADER)).toBe('true')
    realFetch.mockRestore()
  })

  it('passes a mutating request through untouched when isPreview is false', async () => {
    const realFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await previewFetch(false, '/api/contracts/c-1', { method: 'PATCH', body: '{}' })
    expect(realFetch).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    realFetch.mockRestore()
  })
})
