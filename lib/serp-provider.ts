/**
 * Pluggable live-SERP rank lookup.
 *
 * The rank tracker's only position source has been Google Search Console
 * (`fetchLatestPosition` in lib/rank-tracker.ts). That has three real
 * limits for client-facing SEO reporting:
 *   1. GSC reports its own *average position* metric, which can differ
 *      meaningfully from where the page actually ranks right now.
 *   2. It requires the client's GSC to be connected to GravHub at all.
 *   3. A keyword with zero impressions returns nothing — so a brand-new
 *      target keyword can't be tracked until it already gets traffic,
 *      which is exactly backwards for an SEO engagement.
 * And competitor tracking was structurally impossible: GSC only ever
 * reports on properties you own, so `competitor_rank_snapshots` was never
 * written by any code path and the Competitors tab was permanently empty.
 *
 * This module adds a real SERP source that is used ONLY when a key is
 * configured. With no key, `isSerpConfigured()` returns false and every
 * caller falls back to the existing GSC path unchanged — so this costs
 * nothing until someone decides to pay for it, and nothing silently
 * degrades if they don't.
 *
 * Configure either via `SERPAPI_KEY` in the environment, or in
 * Admin → Integrations (stored encrypted in `app_settings.serpapi.apiKey`,
 * the same pattern lib/mercury.ts and the Stripe/HubSpot keys use).
 */

const SERPAPI_BASE = 'https://serpapi.com/search.json'
/** SerpApi bills per search; cap results so one lookup can't run away. */
const RESULT_DEPTH = 100
const REQUEST_TIMEOUT_MS = 20_000

export interface SerpPositionResult {
  /** 1-based position, or null when the domain isn't in the top RESULT_DEPTH. */
  position: number | null
  /** The URL that ranked, when found — useful for "is the right page ranking?" */
  url: string | null
}

export async function getSerpApiKey(): Promise<string | null> {
  if (process.env.SERPAPI_KEY) return process.env.SERPAPI_KEY
  try {
    const { createServiceClient } = await import('@/lib/supabase')
    const { decrypt } = await import('@/lib/encryption')
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('serpapi')
      .eq('id', 'global')
      .maybeSingle()
    const apiKey = (data?.serpapi as { apiKey?: string } | undefined)?.apiKey
    return apiKey ? decrypt(apiKey) : null
  } catch {
    return null
  }
}

export async function isSerpConfigured(): Promise<boolean> {
  return (await getSerpApiKey()) !== null
}

/** Bare hostname, lowercased, `www.` stripped — for comparing a result URL
 *  against a tracked site or competitor domain. */
export function normalizeDomain(input: string): string {
  const raw = (input ?? '').trim().toLowerCase()
  if (!raw) return ''
  try {
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`
    return new URL(withScheme).hostname.replace(/^www\./, '')
  } catch {
    return raw.replace(/^www\./, '').split('/')[0]
  }
}

/**
 * Look up where `domain` currently ranks for `keyword`.
 *
 * Returns null (not a thrown error) when SERP isn't configured, so callers
 * can cleanly fall back to GSC. A genuine API failure also returns null and
 * logs — a rank check failing must never take down the cron that runs it
 * alongside a dozen other jobs.
 */
export async function fetchSerpPosition(params: {
  keyword: string
  domain: string
  country?: string
  location?: string
}): Promise<SerpPositionResult | null> {
  const apiKey = await getSerpApiKey()
  if (!apiKey) return null

  const target = normalizeDomain(params.domain)
  if (!target || !params.keyword.trim()) return null

  const query = new URLSearchParams({
    engine: 'google',
    q: params.keyword,
    num: String(RESULT_DEPTH),
    gl: (params.country ?? 'US').toLowerCase(),
    api_key: apiKey,
  })
  if (params.location) query.set('location', params.location)

  try {
    const res = await fetch(`${SERPAPI_BASE}?${query.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[serp-provider] lookup failed (${res.status}) for "${params.keyword}"`)
      return null
    }
    const body = await res.json() as { organic_results?: { position?: number; link?: string }[] }
    const results = body.organic_results ?? []

    for (const r of results) {
      if (!r.link) continue
      if (normalizeDomain(r.link) === target) {
        return { position: r.position ?? null, url: r.link }
      }
    }
    // Genuinely not ranking in the top N — distinct from "lookup failed",
    // which returns null above so the caller can fall back rather than
    // recording a false "not ranking".
    return { position: null, url: null }
  } catch (err) {
    console.error('[serp-provider] lookup threw:', err instanceof Error ? err.message : err)
    return null
  }
}
