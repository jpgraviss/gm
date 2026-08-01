import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/request-ip'

// AUDIT #653 — getClientIp() used to take the FIRST (leftmost) entry of
// x-forwarded-for, exactly the part of the header a client fully
// controls, letting any caller bypass the IP Restriction admin feature
// and defeat IP-keyed rate limiters by sending a forged header.

function reqWithHeaders(headers: Record<string, string>) {
  return new NextRequest(new URL('http://localhost/api/whatever'), { headers })
}

describe('getClientIp (#653)', () => {
  it('prefers x-vercel-forwarded-for over everything else', () => {
    const req = reqWithHeaders({
      'x-vercel-forwarded-for': '9.9.9.9',
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('falls back to x-real-ip when x-vercel-forwarded-for is absent', () => {
    const req = reqWithHeaders({
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    })
    expect(getClientIp(req)).toBe('8.8.8.8')
  })

  it('takes the LAST hop of x-forwarded-for, not the client-spoofable first hop', () => {
    const req = reqWithHeaders({
      'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.9.9.9',
    })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('an attacker prepending a forged leading entry no longer changes the resolved IP', () => {
    const legit = reqWithHeaders({ 'x-forwarded-for': '5.6.7.8' })
    const spoofed = reqWithHeaders({ 'x-forwarded-for': '10.0.0.1, 5.6.7.8' })
    expect(getClientIp(spoofed)).toBe(getClientIp(legit))
  })

  it('returns "unknown" when no relevant header is present', () => {
    const req = reqWithHeaders({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
