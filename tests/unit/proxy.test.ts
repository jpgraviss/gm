import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

function makeRequest(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
  } = {}
) {
  const { method = 'GET', headers = {} } = options
  const url = new URL(path, 'http://localhost')
  return new NextRequest(url, {
    method,
    headers: new Headers(headers),
  })
}

describe('proxy — CSRF protection', () => {
  it('blocks cross-origin POST requests', async () => {
    const req = makeRequest('/api/deals', {
      method: 'POST',
      headers: {
        origin: 'http://evil.com',
        host: 'localhost',
      },
    })

    const res = await proxy(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Cross-origin request blocked')
  })

  it('allows same-origin POST requests to public routes', async () => {
    const req = makeRequest('/api/auth/google-verify', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        host: 'localhost',
      },
    })

    const res = await proxy(req)
    expect(res.status).toBe(200)
  })

  it('allows GET requests without CSRF check', async () => {
    const req = makeRequest('/api/deals', {
      method: 'GET',
      headers: {
        origin: 'http://evil.com',
        host: 'localhost',
        authorization: 'Bearer token',
      },
    })

    const res = await proxy(req)
    // GET bypasses CSRF so it should reach the auth check and pass (has auth header)
    expect(res.status).toBe(200)
  })
})

describe('proxy — rate limiting', () => {
  it('returns 429 when general API rate limit is exceeded', async () => {
    // Fire 201 authenticated requests — limit is 200/min
    let lastRes
    for (let i = 0; i < 201; i++) {
      const req = makeRequest('/api/deals', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token',
          'x-forwarded-for': '10.0.0.201',
        },
      })
      lastRes = await proxy(req)
    }

    expect(lastRes!.status).toBe(429)
    const body = await lastRes!.json()
    expect(body.error).toContain('Rate limit exceeded')
  })

  // AUDIT #660 — POST /api/ai/audit is the most LLM-call-heavy route in
  // the app (its own code comment: up to 8 sections x 3 retries + a
  // summary call), yet it only ever fell back to the generic 200/min
  // ceiling shared by every route. Now has its own tighter 10/min cap.
  it('returns 429 on the 11th POST /api/ai/audit within a minute, well before the generic 200/min ceiling', async () => {
    let lastRes
    for (let i = 0; i < 11; i++) {
      const req = makeRequest('/api/ai/audit', {
        method: 'POST',
        headers: {
          authorization: 'Bearer token',
          origin: 'http://localhost',
          host: 'localhost',
          'x-forwarded-for': '10.0.0.202',
        },
      })
      lastRes = await proxy(req)
    }

    expect(lastRes!.status).toBe(429)
    const body = await lastRes!.json()
    expect(body.error).toContain('audit')
  })

  it('does not rate-limit ai/audit requests from a different IP', async () => {
    for (let i = 0; i < 10; i++) {
      await proxy(makeRequest('/api/ai/audit', {
        method: 'POST',
        headers: { authorization: 'Bearer token', origin: 'http://localhost', host: 'localhost', 'x-forwarded-for': '10.0.0.203' },
      }))
    }
    const res = await proxy(makeRequest('/api/ai/audit', {
      method: 'POST',
      headers: { authorization: 'Bearer token', origin: 'http://localhost', host: 'localhost', 'x-forwarded-for': '10.0.0.204' },
    }))
    expect(res.status).not.toBe(429)
  })
})
