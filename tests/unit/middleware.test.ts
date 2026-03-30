import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The middleware uses setInterval at module level — mock it so it doesn't leak
vi.stubGlobal('setInterval', vi.fn())

import { middleware } from '@/middleware'

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

describe('middleware — CSRF protection', () => {
  it('blocks cross-origin POST requests', async () => {
    const req = makeRequest('/api/deals', {
      method: 'POST',
      headers: {
        origin: 'http://evil.com',
        host: 'localhost',
      },
    })

    const res = middleware(req)
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

    const res = middleware(req)
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

    const res = middleware(req)
    // GET bypasses CSRF so it should reach the auth check and pass (has auth header)
    expect(res.status).toBe(200)
  })
})

describe('middleware — rate limiting', () => {
  it('returns 429 when admin setup rate limit is exceeded', async () => {
    // Fire 6 requests — limit is 5 per hour
    let lastRes
    for (let i = 0; i < 6; i++) {
      const req = makeRequest('/api/admin/setup', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          host: 'localhost',
          'x-forwarded-for': '10.0.0.99',
        },
      })
      lastRes = middleware(req)
    }

    expect(lastRes!.status).toBe(429)
    const body = await lastRes!.json()
    expect(body.error).toContain('Too many requests')
  })
})
