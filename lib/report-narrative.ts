import { chatCompletion } from '@/lib/ai-client'
import type { ClientReportData } from '@/lib/client-reports'

export interface GrowthNarrative {
  monthInOneLine: string
  searchVisibility: string
  trafficChannels: string
  engagement: string
  source: 'ai' | 'fallback'
}

export interface PreviousPeriodMetrics {
  seo?: { clicks?: number; impressions?: number; avgPosition?: number }
  traffic?: { sessions?: number; users?: number }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function deltaPhrase(label: string, from: number | undefined, to: number, lowerIsBetter = false): string {
  if (from === undefined || from === 0) return `${label} stood at ${to} this period.`
  const changed = to - from
  if (changed === 0) return `${label} held steady at ${to}.`
  const better = lowerIsBetter ? changed < 0 : changed > 0
  const verb = better ? 'improved' : 'moved'
  return `${label} ${verb} from ${from} to ${to}.`
}

/**
 * Deterministic, always-available narrative built directly from the real
 * numbers — no AI required. Used when no AI provider is configured, or if
 * the AI call fails/returns something unusable, so the report never ships
 * with an empty or broken narrative section.
 */
function fallbackNarrative(data: ClientReportData, prev: PreviousPeriodMetrics): GrowthNarrative {
  const lines = { monthInOneLine: '', searchVisibility: '', trafficChannels: '', engagement: '' }

  const headline: string[] = []
  if (data.seo) headline.push(`${data.seo.clicks} organic clicks`)
  if (data.traffic) headline.push(`${data.traffic.sessions} sessions`)
  lines.monthInOneLine = headline.length > 0
    ? `This period recorded ${headline.join(' and ')} across ${data.period.label}.`
    : 'Not enough data available this period.'

  lines.searchVisibility = data.seo
    ? [
        deltaPhrase('Clicks', prev.seo?.clicks, data.seo.clicks),
        deltaPhrase('Impressions', prev.seo?.impressions, data.seo.impressions),
        deltaPhrase('Average position', prev.seo?.avgPosition !== undefined ? round1(prev.seo.avgPosition) : undefined, round1(data.seo.avgPosition), true),
      ].join(' ')
    : 'Not enough data available this period.'

  lines.trafficChannels = data.traffic && data.traffic.channels.length > 0
    ? (() => {
        const top = [...data.traffic!.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 3)
        const total = data.traffic!.channels.reduce((s, c) => s + c.sessions, 0)
        return `The top traffic channel was ${top[0].channel} with ${top[0].sessions} sessions${total > 0 ? ` (${Math.round((top[0].sessions / total) * 100)}% of total)` : ''}. ${
          top.length > 1 ? `Followed by ${top.slice(1).map(c => `${c.channel} (${c.sessions})`).join(' and ')}.` : ''
        }`.trim()
      })()
    : 'Not enough data available this period.'

  lines.engagement = data.traffic
    ? `The site drew ${data.traffic.users} users across ${data.traffic.sessions} sessions, averaging ${Math.round(data.traffic.avgSessionDurationSec / 60)}m per session with a ${round1(data.traffic.bounceRate)}% bounce rate.${prev.traffic?.users !== undefined ? ` ${deltaPhrase('Users', prev.traffic.users, data.traffic.users)}` : ''}`
    : 'Not enough data available this period.'

  return { ...lines, source: 'fallback' }
}

/**
 * Writes the narrative sections of the growth report. Strictly grounded —
 * the AI prompt hands over only the exact numbers already on the report and
 * instructs it not to invent anything; if AI isn't configured (no
 * OLLAMA_URL/GROQ_API_KEY) or the call fails, falls back to a deterministic
 * template built from the same real numbers so a section is never empty or
 * fabricated.
 */
export async function generateGrowthNarrative(
  data: ClientReportData,
  prev: PreviousPeriodMetrics = {},
): Promise<GrowthNarrative> {
  const fallback = fallbackNarrative(data, prev)

  const facts: string[] = []
  if (data.seo) {
    facts.push(
      `Search Console — clicks: ${data.seo.clicks} (previous period: ${prev.seo?.clicks ?? 'no prior data'}), ` +
      `impressions: ${data.seo.impressions} (previous: ${prev.seo?.impressions ?? 'no prior data'}), ` +
      `average position: ${round1(data.seo.avgPosition)} (previous: ${prev.seo?.avgPosition !== undefined ? round1(prev.seo.avgPosition) : 'no prior data'}), ` +
      `CTR: ${round1(data.seo.ctr)}%.`
    )
  }
  if (data.traffic) {
    facts.push(
      `Google Analytics — sessions: ${data.traffic.sessions}, users: ${data.traffic.users} (previous period users: ${prev.traffic?.users ?? 'no prior data'}), ` +
      `pageviews: ${data.traffic.pageviews}, avg session duration: ${Math.round(data.traffic.avgSessionDurationSec / 60)} minutes, bounce rate: ${round1(data.traffic.bounceRate)}%.`
    )
    if (data.traffic.channels.length > 0) {
      const top = [...data.traffic.channels].sort((a, b) => b.sessions - a.sessions).slice(0, 5)
      facts.push(`Top traffic channels by sessions: ${top.map(c => `${c.channel} (${c.sessions} sessions, ${c.users} users)`).join('; ')}.`)
    }
  }
  if (data.ranking) {
    facts.push(
      `Keyword tracking — ${data.ranking.tracked} keywords tracked, ${data.ranking.top10} rank in the top 10, ` +
      `${data.ranking.top3} rank in the top 3, ${data.ranking.improved} improved and ${data.ranking.declined} declined this period.`
    )
  }

  if (facts.length === 0) return fallback

  try {
    const res = await chatCompletion({
      system:
        'You are writing a client-facing monthly SEO/marketing report. Write exactly 4 short sections ' +
        '(2-3 sentences each), separated by a line containing only "---". Section order: ' +
        '(1) a one-line "month in one line" summary, (2) search visibility & rankings, (3) traffic channels, ' +
        '(4) user engagement. Use ONLY the numbers provided below — never invent a number, percentage, page ' +
        'name, or keyword that is not given. If a section genuinely lacks supporting data, write exactly: ' +
        '"Not enough data available this period." Confident, professional marketing-agency tone. No markdown, ' +
        'no bullet points, plain prose only.',
      messages: [{ role: 'user', content: facts.join('\n') }],
      maxTokens: 700,
      timeoutMs: 20_000,
    })

    if (res.finishReason !== 'stop' || !res.text.trim()) return fallback

    const parts = res.text.split(/\n?---\n?/).map(s => s.trim()).filter(Boolean)
    if (parts.length < 4) return fallback

    return {
      monthInOneLine: parts[0],
      searchVisibility: parts[1],
      trafficChannels: parts[2],
      engagement: parts[3],
      source: 'ai',
    }
  } catch (err) {
    console.error('[report-narrative] AI generation failed, using fallback', err)
    return fallback
  }
}
