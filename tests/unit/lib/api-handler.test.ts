import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock Sentry before importing the module under test
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { withErrorHandler } from '@/lib/api-handler'
import * as Sentry from '@sentry/nextjs'

function makeRequest(url = 'http://localhost/api/test', method = 'GET') {
  return new NextRequest(new URL(url), { method })
}

describe('withErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the handler response on success', async () => {
    const handler = withErrorHandler('test', async () => {
      return NextResponse.json({ ok: true }, { status: 200 })
    })

    const res = await handler(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('catches errors and returns 500 with error message', async () => {
    const handler = withErrorHandler('test', async () => {
      throw new Error('Something broke')
    })

    const res = await handler(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Something broke' })
  })

  it('returns generic message for non-Error throws', async () => {
    const handler = withErrorHandler('test', async () => {
      throw 'string error'
    })

    const res = await handler(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Internal server error' })
  })

  it('calls Sentry.captureException with context', async () => {
    const err = new Error('Tracked error')
    const handler = withErrorHandler('deals POST', async () => {
      throw err
    })

    const req = makeRequest('http://localhost/api/deals', 'POST')
    await handler(req)

    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { route: 'deals POST' },
      extra: { url: 'http://localhost/api/deals', method: 'POST' },
    })
  })
})
