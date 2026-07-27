// Shared SSRF-safe website fetcher for AI-enrichment routes (crm/enrich,
// ai/analyze-website) — a caller-supplied URL fetched server-side is a
// classic SSRF vector, so every hop (including redirects) is re-validated
// against loopback/private/link-local ranges before being followed.
//
// AUDIT #319 — validating a hostname's DNS answer and then letting fetch()
// do its OWN independent DNS resolution to actually connect is a classic
// TOCTOU rebind: an attacker who controls the domain's nameserver can answer
// the validation lookup with a public IP and the connection's lookup
// (moments later) with 127.0.0.1 / 169.254.169.254 / an internal address.
// Every address used to actually connect must be the exact one that was
// validated. We do that by pinning the undici `Agent`'s connector to the
// validated IP via a custom `lookup` (the same mechanism Node's own
// net.connect/tls.connect expose for this) while leaving the original
// hostname as the request URL/authority — so TLS SNI and the Host header
// sent to the origin are unaffected and still target the real hostname.
import dns from 'dns/promises'
import net from 'net'
import { Agent } from 'undici'

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true
  const [a, b] = parts
  if (a === 127) return true // loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 0) return true
  return false
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return true // link-local / unique-local
    // AUDIT — IPv4-mapped IPv6 (::ffff:a.b.c.d) was never checked, so a
    // DNS record pointing at ::ffff:169.254.169.254 (or ::ffff:127.0.0.1)
    // passed this guard even though most dual-stack network stacks route
    // it as a plain connection to the embedded IPv4 address — a clean
    // bypass of every IPv4 private/loopback/metadata check below.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIPv4(mapped[1])
    return false
  }
  return isPrivateIPv4(ip)
}

type SafeIpResolution =
  | { safe: true; ip: string; family: 4 | 6 }
  | { safe: false }

/**
 * Validates `url` the same way `isSafeToFetch` does, but also returns the
 * exact resolved address that was checked, so callers can pin their actual
 * connection to it instead of triggering a second, independent DNS lookup
 * (the TOCTOU gap this function exists to close — see AUDIT #319).
 */
async function resolveSafeIp(url: URL): Promise<SafeIpResolution> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { safe: false }
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return { safe: false }
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    if (addresses.length === 0) return { safe: false }
    if (addresses.some(a => isPrivateOrLoopbackIp(a.address))) return { safe: false }
    const [{ address, family }] = addresses
    return { safe: true, ip: address, family: family === 6 ? 6 : 4 }
  } catch {
    return { safe: false }
  }
}

export async function isSafeToFetch(url: URL): Promise<boolean> {
  return (await resolveSafeIp(url)).safe
}

/**
 * Builds a per-request undici Agent whose connector always connects to
 * `ip`, bypassing a fresh DNS lookup at connect time. `hostname`/TLS
 * servername are untouched (the connector still receives the original
 * request authority), so SNI and the Host header sent to the origin
 * server are unaffected — only the socket's actual destination is pinned.
 */
function createPinnedDispatcher(ip: string, family: 4 | 6): Agent {
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

export function parseWebsiteUrl(rawUrl: string): URL | null {
  try {
    const normalized = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    return new URL(normalized)
  } catch {
    return null
  }
}

export type FetchSafeHtmlResult =
  | { ok: true; html: string; url: URL }
  | { ok: false; error: string; status: number }

/** Fetches `url`, re-validating every redirect hop, bounded at 5 hops. */
export async function fetchSafeHtml(url: URL): Promise<FetchSafeHtmlResult> {
  const initialResolution = await resolveSafeIp(url)
  if (!initialResolution.safe) {
    return { ok: false, error: 'This URL cannot be fetched', status: 400 }
  }
  let pinned = initialResolution
  // Tracks the dispatcher for the hop currently "in play" so the outer
  // finally can always tear it down, however the loop exits.
  let dispatcher: Agent | undefined
  try {
    let currentUrl = url
    let res: Response
    for (let hop = 0; ; hop++) {
      if (hop > 5) {
        return { ok: false, error: 'Too many redirects', status: 502 }
      }
      // Connect to the exact address validated above/on the previous hop —
      // never let fetch() re-resolve the hostname itself (see AUDIT #319).
      dispatcher = createPinnedDispatcher(pinned.ip, pinned.family)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const requestInit: RequestInit & { dispatcher: Agent } = {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GravHubBot/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
        dispatcher,
      }
      try {
        res = await fetch(currentUrl.toString(), requestInit)
      } finally {
        clearTimeout(timeout)
      }

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        // Body isn't needed for a redirect response — drop this hop's
        // connection immediately rather than waiting on it.
        await dispatcher.destroy()
        dispatcher = undefined
        const nextUrl = new URL(res.headers.get('location')!, currentUrl)
        const nextResolution = await resolveSafeIp(nextUrl)
        if (!nextResolution.safe) {
          return { ok: false, error: 'This URL cannot be fetched', status: 400 }
        }
        currentUrl = nextUrl
        pinned = nextResolution
        continue
      }
      break
    }
    if (!res.ok) {
      return { ok: false, error: `Site returned ${res.status}`, status: 502 }
    }
    return { ok: true, html: await res.text(), url: currentUrl }
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out'
      : 'Could not reach the website'
    return { ok: false, error: message, status: 502 }
  } finally {
    await dispatcher?.destroy()
  }
}

/** Strips scripts/styles/tags and collapses whitespace for feeding to an LLM. */
export function htmlToText(html: string, maxLength = 3000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
