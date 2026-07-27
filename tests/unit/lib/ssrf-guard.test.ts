import { describe, it, expect, vi, beforeEach } from 'vitest'
import http from 'http'

// `dns.lookup` is mocked so DNS-dependent tests are deterministic (no real
// network lookups for fake hostnames). Built via vi.hoisted() + a shared
// `lookupMock` reference and re-exported under both the named `promises`
// export and `default.promises` — lib/ssrf-guard.ts (`import { promises as
// dns } from 'dns'`) and this file's own `dns` import must resolve to the
// exact same mock function, and vitest's CJS/ESM interop for built-in
// modules needs a `default` key present or module resolution errors when a
// second module graph node (lib/ssrf-guard.ts) loads the same mock.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))
vi.mock('dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dns')>()
  const promises = { ...actual.promises, lookup: lookupMock }
  return {
    ...actual,
    promises,
    default: { ...(actual as unknown as { default?: object }).default, promises },
  }
})

import { promises as dns } from 'dns'
import { resolveSafeIp, isPrivateOrInternalUrl, createPinnedDispatcher } from '@/lib/ssrf-guard'

describe('ssrf-guard', () => {
  beforeEach(() => {
    lookupMock.mockReset()
  })

  describe('resolveSafeIp / isPrivateOrInternalUrl', () => {
    it('rejects malformed URLs', async () => {
      expect(await resolveSafeIp('not a url')).toEqual({ safe: false })
      expect(await isPrivateOrInternalUrl('not a url')).toBe(true)
    })

    it('rejects localhost and .local hostnames without a DNS lookup', async () => {
      expect(await resolveSafeIp('http://localhost/')).toEqual({ safe: false })
      expect(await resolveSafeIp('http://printer.local/')).toEqual({ safe: false })
      expect(dns.lookup).not.toHaveBeenCalled()
    })

    it('rejects IP-literal loopback/private/metadata targets directly, without a DNS lookup', async () => {
      for (const host of ['127.0.0.1', '169.254.169.254', '10.0.0.5', '192.168.1.1', '[::1]']) {
        expect(await resolveSafeIp(`http://${host}/`)).toEqual({ safe: false })
      }
      expect(dns.lookup).not.toHaveBeenCalled()
    })

    it('accepts a public IP literal and returns it unchanged', async () => {
      const result = await resolveSafeIp('http://93.184.216.34/')
      expect(result).toEqual({ safe: true, ip: '93.184.216.34', family: 4 })
      expect(dns.lookup).not.toHaveBeenCalled()
    })

    it('rejects a hostname that resolves to a private address', async () => {
      vi.mocked(dns.lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
      expect(await isPrivateOrInternalUrl('http://evil.example.com/')).toBe(true)
    })

    it('rejects if ANY resolved address is private, even when others are public', async () => {
      vi.mocked(dns.lookup).mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ] as never)
      expect(await isPrivateOrInternalUrl('http://mixed.example.com/')).toBe(true)
    })

    it('returns the exact validated address for a public hostname', async () => {
      vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)
      const result = await resolveSafeIp('http://safe.example.com/')
      expect(result).toEqual({ safe: true, ip: '93.184.216.34', family: 4 })
    })

    it('fails closed when the DNS lookup errors', async () => {
      vi.mocked(dns.lookup).mockRejectedValue(new Error('ENOTFOUND'))
      expect(await isPrivateOrInternalUrl('http://nowhere.example.com/')).toBe(true)
    })

    it('fails closed on an empty DNS answer', async () => {
      vi.mocked(dns.lookup).mockResolvedValue([] as never)
      expect(await isPrivateOrInternalUrl('http://empty.example.com/')).toBe(true)
    })

    it('rejects non-http(s) protocols', async () => {
      expect(await resolveSafeIp('file:///etc/passwd')).toEqual({ safe: false })
    })
  })

  describe('createPinnedDispatcher', () => {
    it('pins the connection to the validated IP, bypassing DNS, while leaving the Host header untouched (AUDIT #414)', async () => {
      const server = http.createServer((req, res) => {
        res.end(JSON.stringify({ host: req.headers.host }))
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as { port: number }).port

      // A hostname that doesn't resolve anywhere. If the dispatcher's
      // pinned `lookup` were bypassed and fetch() performed its own,
      // independent resolution (the AUDIT #414 TOCTOU gap), this request
      // would fail with ENOTFOUND. Success proves the connection actually
      // used the pinned IP, not a fresh lookup of the hostname.
      const hostname = 'this-host-does-not-exist.invalid'
      const dispatcher = createPinnedDispatcher('127.0.0.1', 4)
      try {
        const res = await fetch(`http://${hostname}:${port}/`, { dispatcher } as RequestInit)
        const body = await res.json()
        expect(res.status).toBe(200)
        // The Host header sent to the origin is still the original
        // hostname — only the socket's real destination was pinned.
        expect(body.host).toBe(`${hostname}:${port}`)
      } finally {
        await dispatcher.destroy()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    })
  })
})
