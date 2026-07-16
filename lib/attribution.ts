// Shared UTM/source-attribution helpers, used on both sides of a public
// funnel/form submission: the browser captures what's on the landing URL,
// the server validates and persists it. Kept in one file so the two never
// drift on which fields exist or how they're capped.

export interface UtmParams {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  landing_url?: string | null
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

// Client-side: read UTM params off the current browser location. A funnel
// page can be a multi-step flow, so this runs at submit time (not just on
// first load) — the query string set by the original ad/campaign click
// stays on the URL for the whole visit since nothing here does a client-side
// navigation that would drop it.
export function utmFromLocation(): UtmParams | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const out: UtmParams = {}
  let hasUtm = false
  for (const key of UTM_KEYS) {
    const v = params.get(key)
    if (v) {
      out[key] = v.slice(0, 500)
      hasUtm = true
    }
  }
  const landingUrl = window.location.href.slice(0, 1000)
  if (!hasUtm && !landingUrl) return null
  out.landing_url = landingUrl
  return out
}

// Server-side: extract from a submitted `utm` object in a public form/funnel
// POST body. Untrusted input — every field is type-checked and length-capped
// before it's ever spread into a DB insert.
export function extractUtmFromBody(utm: unknown): UtmParams {
  if (!utm || typeof utm !== 'object') return {}
  const u = utm as Record<string, unknown>
  const pick = (key: string, max = 500): string | null =>
    typeof u[key] === 'string' && u[key] ? (u[key] as string).slice(0, max) : null
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_term: pick('utm_term'),
    utm_content: pick('utm_content'),
    landing_url: pick('landing_url', 1000),
  }
}
