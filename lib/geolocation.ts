// IP geolocation for GravIntel visitor tracking (AUDIT.md #33). Held on
// hold pending a decision on which paid provider to use — this wires the
// full integration against ipinfo.io (simple REST API, generous free
// tier: 50k lookups/month) so it activates automatically the moment
// IPINFO_API_KEY is set in the environment, with zero code changes.
// Until then, isGeolocationConfigured() is false and every lookup is a
// no-op — no network calls, no partial/fabricated data.
//
// To activate: get a token at https://ipinfo.io/signup, set
// IPINFO_API_KEY in Vercel's environment variables, and redeploy (Vercel
// env vars are baked in at deploy time, so a plain env var change alone
// won't take effect until the next deployment).

export interface IpGeolocation {
  city: string | null
  region: string | null
  country: string | null
  isp: string | null
  rdnsCompany: string | null
}

export function isGeolocationConfigured(): boolean {
  return !!process.env.IPINFO_API_KEY
}

const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^fc00:/, /^fe80:/,
]

function isPrivateOrUnknown(ip: string): boolean {
  if (!ip || ip === 'unknown') return true
  return PRIVATE_IP_PATTERNS.some((p) => p.test(ip))
}

// Best-effort — returns null on missing config, private/unknown IP,
// network failure, or a non-200 response. Never throws, so callers can
// treat this as an optional enrichment step, not a required dependency.
export async function lookupIpGeolocation(ip: string): Promise<IpGeolocation | null> {
  const token = process.env.IPINFO_API_KEY
  if (!token || isPrivateOrUnknown(ip)) return null

  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json() as { city?: string; region?: string; country?: string; org?: string }
    // ipinfo's `org` field looks like "AS15169 Google LLC" — strip the ASN prefix for a clean company name.
    const org = data.org ?? null
    return {
      city: data.city ?? null,
      region: data.region ?? null,
      country: data.country ?? null,
      isp: org,
      rdnsCompany: org ? org.replace(/^AS\d+\s*/, '') : null,
    }
  } catch {
    return null
  }
}
