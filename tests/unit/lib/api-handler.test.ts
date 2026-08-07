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

  // AUDIT #771 — the branch that actually protects a caller had no test.
  // In the suite NODE_ENV is 'test', so every case above takes the
  // raw-message path; the production path — which is what stops a Postgres
  // error string, a config variable name or a file path reaching an
  // external caller — was never exercised. Verified by hand against a real
  // production build (a route whose DB call failed returned
  // {"error":"Internal server error"}); this keeps it true.
  it('replaces the real message with a generic one in production', async () => {
    const prev = process.env.NODE_ENV
    // NODE_ENV is readonly in the Next.js types, hence the cast.
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    try {
      const handler = withErrorHandler('test', async () => {
        throw new Error('relation "invoices" does not exist')
      })

      const res = await handler(makeRequest())
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body).toEqual({ error: 'Internal server error' })
      expect(JSON.stringify(body)).not.toContain('invoices')
    } finally {
      ;(process.env as Record<string, string>).NODE_ENV = prev as string
    }
  })

  it('still reports the real error to Sentry in production', async () => {
    // Sanitising the response must not sanitise the diagnostics — the whole
    // point is that the detail goes to logs and Sentry instead.
    const prev = process.env.NODE_ENV
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    try {
      const err = new Error('relation "invoices" does not exist')
      const handler = withErrorHandler('invoices GET', async () => { throw err })
      await handler(makeRequest())
      expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.anything())
    } finally {
      ;(process.env as Record<string, string>).NODE_ENV = prev as string
    }
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
