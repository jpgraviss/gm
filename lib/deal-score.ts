// Deal health score — deliberately rule-based, not an LLM guess. An LLM
// asked to "score this deal" with no real signal to reason from would be
// exactly the kind of fabricated-looking-real number flagged elsewhere in
// AUDIT.md (the AI Website Audit finding). Every input here is a real,
// already-stored field.

export interface DealScoreFactor {
  label: string
  detail: string
  positive: boolean
}

export interface DealScoreInput {
  probability: number
  lastActivity: string | null | undefined
  closeDate: string | null | undefined
  stage: string
}

export interface DealScoreResult {
  score: number
  factors: DealScoreFactor[]
}

const CLOSED_STAGES = new Set(['Closed Won', 'Closed Lost'])

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return Infinity
  return Math.floor((Date.now() - then) / 86400000)
}

export function computeDealScore(deal: DealScoreInput): DealScoreResult {
  const factors: DealScoreFactor[] = []

  const probability = Math.max(0, Math.min(100, deal.probability))
  const probabilityScore = probability * 0.5
  factors.push({
    label: 'Progression',
    detail: `Deal probability is ${probability}%`,
    positive: probability >= 50,
  })

  let recencyScore = 0
  if (deal.lastActivity) {
    const since = daysSince(deal.lastActivity)
    if (since <= 2) recencyScore = 50
    else if (since <= 7) recencyScore = 40
    else if (since <= 14) recencyScore = 25
    else if (since <= 30) recencyScore = 10
    factors.push({
      label: 'Engagement',
      detail: since === 0 ? 'Active today' : `${since} day${since === 1 ? '' : 's'} since last activity`,
      positive: since <= 7,
    })
  } else {
    factors.push({ label: 'Engagement', detail: 'No activity logged yet', positive: false })
  }

  let overduePenalty = 0
  if (deal.closeDate && !CLOSED_STAGES.has(deal.stage)) {
    const overdueDays = daysSince(deal.closeDate) // positive = past due
    if (overdueDays > 0) {
      overduePenalty = 15
      factors.push({
        label: 'Timeline',
        detail: `${overdueDays} day${overdueDays === 1 ? '' : 's'} past the expected close date`,
        positive: false,
      })
    }
  }

  const score = Math.round(Math.max(0, Math.min(100, probabilityScore + recencyScore - overduePenalty)))
  return { score, factors }
}
