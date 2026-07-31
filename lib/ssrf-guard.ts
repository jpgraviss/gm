import { promises as dns } from 'dns'
import net from 'net'
import { Agent } from 'undici'

// AUDIT.md #260 — POST /api/monitored-sites only validated the target was a
// well-formed http(s):// URL, with no private/internal-range denylist, and
// lib/uptime.ts fetches it following redirects — a staff member (or a
// compromised client site redirecting internally) could cause the server to
// request internal/metadata endpoints. Mirrors the WordPress plugin's
// wp_safe_remote_* fix (#190), which blocks loopback/private/link-local
// ranges including the 169.254.169.254 cloud metadata address.
//
// AUDIT #414 — this module validated a hostname's DNS answer and then let
// the caller's own, independent fetch() resolve the hostname again to
// actually connect: the identical DNS-rebinding TOCTOU gap #319 fixed in
// lib/website-fetch.ts. An attacker-controlled nameserver could answer the
// validation lookup with a public IP and the connection's lookup (moments
// later, in lib/uptime.ts / lib/wordpress.ts) with a private/internal one.
// `resolveSafeIp()` now returns the exact validated address instead of just
// a boolean, and `createPinnedDispatcher()` lets callers pin their actual
// fetch to it via a custom undici `connect.lookup` — the same mechanism
// lib/website-fetch.ts uses — while leaving the original hostname as the
// request URL/authority so TLS SNI and the Host header are unaffected.
// `isPrivateOrInternalUrl()` keeps its original boolean signature (now
// implemented in terms of `resolveSafeIp()`) for the monitored-sites
// create/update routes, which only use it as a write-time validation gate
// with no fetch immediately following — those don't need pinning since
// there's no connection to rebind in the same request. The two callers that
// actually fetch the URL (lib/uptime.ts, lib/wordpress.ts) now use
// `resolveSafeIp()` + `createPinnedDispatcher()` directly.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false
  const [a, b] = parts
  if (a === 127) return true // loopback
  if (a === 10) return true // private
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 0) return true // "this" network
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address too
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip)
  if (net.isIPv6(ip)) return isPrivateIPv6(ip)
  return false
}

type SafeIpResolution =
  | { safe: true; ip: string; family: 4 | 6 }
  | { safe: false }

/**
 * Resolves `url`'s hostname and, if it (and every address it resolves to)
 * is safe to connect to, returns the exact validated address — so callers
 * can pin their actual connection to it instead of triggering a second,
 * independent DNS lookup at fetch time (the TOCTOU gap AUDIT #414 closes).
 * Fails closed: any parse error, empty answer, or lookup error is unsafe.
 */
export async function resolveSafeIp(url: string): Promise<SafeIpResolution> {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return { safe: false }
  }

  const bareHost = hostname.replace(/^\[|\]$/g, '')
  if (bareHost === 'localhost' || bareHost.endsWith('.local')) return { safe: false }

  if (net.isIP(bareHost)) {
    if (isPrivateIP(bareHost)) return { safe: false }
    return { safe: true, ip: bareHost, family: net.isIPv6(bareHost) ? 6 : 4 }
  }

  try {
    const addresses = await dns.lookup(bareHost, { all: true })
    if (addresses.length === 0) return { safe: false }
    if (addresses.some(a => isPrivateIP(a.address))) return { safe: false }
    const [{ address, family }] = addresses
    return { safe: true, ip: address, family: family === 6 ? 6 : 4 }
  } catch {
    return { safe: false }
  }
}

/**
 * Resolves `url`'s hostname and returns true if it (or any of its resolved
 * addresses) points at a loopback/private/link-local range. Fails closed —
 * a lookup error is treated as unsafe rather than silently allowed through.
 *
 * This is a validation-only check (kept for the monitored-sites
 * create/update routes, which use it as a write-time gate with no fetch
 * immediately following). Callers that go on to fetch the URL themselves
 * should use `resolveSafeIp()` + `createPinnedDispatcher()` instead, so the
 * connection is pinned to the address that was actually validated.
 */
export async function isPrivateOrInternalUrl(url: string): Promise<boolean> {
  return !(await resolveSafeIp(url)).safe
}

/**
 * Builds a per-request undici Agent whose connector always connects to
 * `ip`, bypassing a fresh DNS lookup at connect time. `hostname`/TLS
 * servername are untouched (the connector still receives the original
 * request authority), so SNI and the Host header sent to the origin server
 * are unaffected — only the socket's actual destination is pinned.
 */
export function createPinnedDispatcher(ip: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        // Node 22 defaults `autoSelectFamily` (Happy Eyeballs) to on, which
        // drives connections through a path that calls `lookup` with
        // `{ all: true }` and expects the array-style dns.lookup callback
        // shape — not the single (address, family) shape. Support both so
        // pinning works regardless of which internal path net/tls takes.
        if (options && options.all) {
          callback(null, [{ address: ip, family }])
        } else {
          callback(null, ip, family)
        }
      },
    },
  })
}

// AUDIT #568 — app/api/calendar/subscriptions/route.ts (POST, and
// syncSubscription() shared by PATCH + the sync-all cron path) and
// app/api/calendar/import-link/route.ts both did a raw fetch(url) against a
// caller-supplied ICS URL with none of the private/internal-range
// protection every other user-supplied-URL fetch in this codebase has —
// the exact SSRF gap #260/#414 closed for monitored-sites. Once a
// malicious ical_url is saved, syncSubscription() re-fetches it on every
// future manual sync and cron sync-all tick with no re-validation, so a
// single successful plant keeps hitting the target indefinitely. This
// helper centralizes the fix: validate + pin the connection to the
// validated address, same as lib/uptime.ts's checkSite(), and throw a
// plain Error the caller can catch and turn into its own error response.
export async function fetchTextSafely(url: string, acceptHeader: string): Promise<string> {
  const resolution = await resolveSafeIp(url)
  if (!resolution.safe) {
    throw new Error('This URL cannot be fetched')
  }
  const dispatcher = createPinnedDispatcher(resolution.ip, resolution.family)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      headers: { Accept: acceptHeader, 'User-Agent': 'GravHub-Calendar/1.0 (+https://app.gravissmarketing.com)' },
      // A redirect to an internal/private address would bypass the
      // validation above entirely if followed automatically — same
      // reasoning as lib/uptime.ts's checkSite(). ICS feed providers don't
      // rely on redirects for this use case, so refusing to follow one is
      // an acceptable trade-off for closing that gap.
      redirect: 'manual',
      signal: controller.signal,
      dispatcher,
    } as RequestInit & { dispatcher: Agent })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
    await dispatcher.destroy()
  }
}
