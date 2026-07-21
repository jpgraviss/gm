import { promises as dns } from 'dns'
import net from 'net'

// AUDIT.md #260 — POST /api/monitored-sites only validated the target was a
// well-formed http(s):// URL, with no private/internal-range denylist, and
// lib/uptime.ts fetches it following redirects — a staff member (or a
// compromised client site redirecting internally) could cause the server to
// request internal/metadata endpoints. Mirrors the WordPress plugin's
// wp_safe_remote_* fix (#190), which blocks loopback/private/link-local
// ranges including the 169.254.169.254 cloud metadata address.

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

/**
 * Resolves `url`'s hostname and returns true if it (or any of its resolved
 * addresses) points at a loopback/private/link-local range. Fails closed —
 * a lookup error is treated as unsafe rather than silently allowed through.
 */
export async function isPrivateOrInternalUrl(url: string): Promise<boolean> {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return true
  }

  const bareHost = hostname.replace(/^\[|\]$/g, '')
  if (bareHost === 'localhost' || bareHost.endsWith('.local')) return true
  if (net.isIP(bareHost)) return isPrivateIP(bareHost)

  try {
    const addresses = await dns.lookup(bareHost, { all: true })
    return addresses.some(a => isPrivateIP(a.address))
  } catch {
    return true
  }
}
