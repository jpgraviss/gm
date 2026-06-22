import { chatCompletion } from '@/lib/ai-client'

export interface LeadScoreResult {
  score: number
  explanation: string
  factors: {
    label: string
    impact: number
    detail: string
  }[]
}

interface ContactData {
  id: string
  fullName: string
  companyName: string
  title: string
  emails: string[]
  lifecycleStage?: string
  leadStatus?: string
  lastActivity?: string
  tags?: string[]
}

interface ActivityData {
  type: string
  timestamp: string
  outcome?: string
}

interface DealData {
  stage: string
  value: number
  probability: number
  lastActivity: string
}

interface EngagementData {
  emailsOpened: number
  linksClicked: number
  proposalsViewed: number
  meetings: number
}

export async function scoreContact(
  contact: ContactData,
  activities: ActivityData[],
  deals: DealData[],
  engagement?: EngagementData,
): Promise<LeadScoreResult> {
  const factors: { label: string; impact: number; detail: string }[] = []
  let score = 0

  const emailOpens = engagement?.emailsOpened ?? 0
  const linkClicks = engagement?.linksClicked ?? 0
  if (emailOpens > 0 || linkClicks > 0) {
    const emailScore = Math.min(20, emailOpens * 3 + linkClicks * 5)
    score += emailScore
    factors.push({ label: 'Email Engagement', impact: emailScore, detail: `${emailOpens} opens, ${linkClicks} clicks` })
  }

  const proposalsViewed = engagement?.proposalsViewed ?? 0
  if (proposalsViewed > 0) {
    const propScore = Math.min(15, proposalsViewed * 8)
    score += propScore
    factors.push({ label: 'Proposal Views', impact: propScore, detail: `${proposalsViewed} proposals viewed` })
  }

  const meetingCount = engagement?.meetings ?? activities.filter(a => a.type === 'meeting').length
  if (meetingCount > 0) {
    const meetScore = Math.min(15, meetingCount * 5)
    score += meetScore
    factors.push({ label: 'Meetings Held', impact: meetScore, detail: `${meetingCount} meetings` })
  }

  const totalDealValue = deals.reduce((s, d) => s + d.value, 0)
  const hasActiveDeal = deals.some(d => !d.stage.startsWith('Closed'))
  if (totalDealValue > 0) {
    const valueScore = totalDealValue >= 50000 ? 15 : totalDealValue >= 20000 ? 10 : totalDealValue >= 5000 ? 7 : 3
    score += valueScore
    factors.push({ label: 'Deal Value', impact: valueScore, detail: `$${totalDealValue.toLocaleString()} total` })
  }
  if (hasActiveDeal) {
    score += 5
    factors.push({ label: 'Active Deal', impact: 5, detail: 'Has deal in pipeline' })
  }

  if (contact.lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(contact.lastActivity).getTime()) / 86400000)
    const recencyScore = daysSince <= 7 ? 15 : daysSince <= 14 ? 10 : daysSince <= 30 ? 5 : daysSince <= 60 ? 2 : 0
    score += recencyScore
    factors.push({ label: 'Recency', impact: recencyScore, detail: daysSince <= 1 ? 'Active today' : `${daysSince}d since last activity` })
  }

  const activityCount = activities.length
  if (activityCount > 0) {
    const actScore = Math.min(10, Math.round(activityCount * 1.5))
    score += actScore
    factors.push({ label: 'Activity Volume', impact: actScore, detail: `${activityCount} logged activities` })
  }

  const avgProb = deals.length > 0 ? deals.reduce((s, d) => s + d.probability, 0) / deals.length : 0
  if (avgProb > 0) {
    const probScore = Math.round(avgProb / 10)
    score += probScore
    factors.push({ label: 'Win Probability', impact: probScore, detail: `${Math.round(avgProb)}% avg probability` })
  }

  score = Math.min(100, Math.max(0, score))

  let explanation = `Lead score of ${score}/100. `
  if (score >= 70) explanation += 'This is a high-priority lead with strong engagement signals.'
  else if (score >= 30) explanation += 'This lead shows moderate engagement and warrants continued nurturing.'
  else explanation += 'This lead has limited engagement. Consider re-engagement strategies.'

  if (factors.length > 0) {
    try {
      const result = await chatCompletion({
        system: 'You are a sales intelligence assistant. Generate a concise 2-3 sentence lead score explanation for internal sales reps. Be specific and actionable.',
        messages: [{
          role: 'user',
          content: `Contact: ${contact.fullName} at ${contact.companyName} (${contact.title})\nLead score: ${score}/100\n\nScoring factors:\n${factors.map(f => `- ${f.label}: +${f.impact} pts (${f.detail})`).join('\n')}\n\nWrite a brief, actionable explanation of this score and what the rep should do next.`,
        }],
        maxTokens: 300,
        fast: true,
      })
      if (result.source !== 'none' && result.text) {
        explanation = result.text
      }
    } catch {
      // keep fallback explanation
    }
  }

  return { score, explanation, factors }
}
