import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Upstash so tests use in-memory fallback
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: vi.fn() }))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: vi.fn() } }))

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
})
