// Shared SSRF-safe website fetcher for AI-enrichment routes (crm/enrich,
// ai/analyze-website) — a caller-supplied URL fetched server-side is a
// classic SSRF vector, so every hop (including redirects) is re-validated
// against loopback/private/link-local ranges before being followed.
import dns from 'dns/promises'
import net from 'net'

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

export async function isSafeToFetch(url: URL): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    return addresses.every(a => !isPrivateOrLoopbackIp(a.address))
  } catch {
    return false
  }
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
  if (!(await isSafeToFetch(url))) {
    return { ok: false, error: 'This URL cannot be fetched', status: 400 }
  }
  try {
    let currentUrl = url
    let res: Response
    for (let hop = 0; ; hop++) {
      if (hop > 5) {
        return { ok: false, error: 'Too many redirects', status: 502 }
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      res = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GravHubBot/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'manual',
      })
      clearTimeout(timeout)

      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const nextUrl = new URL(res.headers.get('location')!, currentUrl)
        if (!(await isSafeToFetch(nextUrl))) {
          return { ok: false, error: 'This URL cannot be fetched', status: 400 }
        }
        currentUrl = nextUrl
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
