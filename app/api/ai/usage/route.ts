import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

// Neither Ollama nor Groq expose a usage-query API this app can call
// directly, so ai_usage_log (populated by every lib/ai-client.ts call) is
// the only way to see real call volume / provider split / quota proximity.
// Admin-only — this is infra-health visibility, not a feature any team
// member needs day to day.
export const GET = withErrorHandler('ai/usage GET', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const db = createServiceClient()
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await db
    .from('ai_usage_log')
    .select('source, feature, total_tokens, success, created_at')
    .gte('created_at', since30d)
    .order('created_at', { ascending: false })
    .limit(10_000)

  if (error) {
    throw new Error(error.message || 'Failed to load AI usage log')
  }

  const all = rows ?? []
  const startOfDay = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  const since24h = startOfDay(1)
  const since7d = startOfDay(7)

  function countSince(iso: string) {
    return all.filter(r => r.created_at >= iso).length
  }

  const bySource: Record<string, number> = {}
  const byFeature: Record<string, number> = {}
  let totalTokens30d = 0
  let failures30d = 0

  for (const r of all) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1
    byFeature[r.feature] = (byFeature[r.feature] ?? 0) + 1
    if (r.total_tokens) totalTokens30d += r.total_tokens
    if (!r.success) failures30d++
  }

  const recentErrors = all.filter(r => !r.success).slice(0, 10)
  const callsLast24h = countSince(since24h)

  // ── Usage alert threshold ────────────────────────────────────────────
  // No provider here exposes a real quota-query API, so this is a call-
  // volume threshold, not a dollar/quota one. 24h (not 30d) is the right
  // granularity for an alert — it's the window that actually maps to how
  // free-tier LLM rate limits reset. Groq is tried first among the three
  // cloud providers (see lib/ai-client.ts) and has historically had the
  // most restrictive free-tier daily cap of the three (commonly cited
  // around ~1,000 requests/day for its larger models; Gemini and Cerebras'
  // free tiers are typically higher). Using that as a conservative,
  // round combined-provider ceiling flags real risk of tripping *some*
  // provider's daily limit without pretending to read an exact live quota.
  const ALERT_THRESHOLD_24H = 1000
  const ALERT_WARN_RATIO = 0.75 // "approaching" once 75% of the ceiling is used
  const alertLevel: 'normal' | 'approaching' | 'over' =
    callsLast24h >= ALERT_THRESHOLD_24H ? 'over'
    : callsLast24h >= ALERT_THRESHOLD_24H * ALERT_WARN_RATIO ? 'approaching'
    : 'normal'

  return NextResponse.json({
    callsLast24h,
    callsLast7d: countSince(since7d),
    callsLast30d: all.length,
    totalTokens30d,
    failures30d,
    bySource,
    byFeature,
    recentErrorCount: recentErrors.length,
    noProviderConfigured: (bySource.none ?? 0) > 0 && (bySource.ollama ?? 0) === 0 && (bySource.groq ?? 0) === 0 && (bySource.gemini ?? 0) === 0 && (bySource.cerebras ?? 0) === 0,
    alertThreshold24h: ALERT_THRESHOLD_24H,
    alertLevel,
  })
})
