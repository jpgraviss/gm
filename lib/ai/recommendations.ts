import { anthropicInsightsModel } from '@/lib/anthropic'

export type RecommendationType = 'follow_up' | 'upsell' | 'at_risk' | 'renewal_reminder' | 'engagement_drop'
export type RecommendationPriority = 'high' | 'medium' | 'low'

export interface Recommendation {
  type: RecommendationType
  priority: RecommendationPriority
  title: string
  description: string
  suggestedAction: string
  companyName?: string
  contactName?: string
}

interface CompanyContext {
  id: string
  name: string
  status: string
  industry: string
  owner: string
  totalDealValue: number
}

interface ContactContext {
  fullName: string
  companyName: string
  lastActivity?: string
  lifecycleStage?: string
}

interface DealContext {
  company: string
  stage: string
  value: number
  lastActivity: string
}

interface ContractContext {
  company: string
  status: string
  renewalDate: string
  value: number
}

interface ActivityContext {
  companyName?: string
  contactName?: string
  type: string
  timestamp: string
}

export async function getRecommendations(opts: {
  companyId?: string
  companies: CompanyContext[]
  contacts: ContactContext[]
  deals: DealContext[]
  contracts: ContractContext[]
  activities: ActivityContext[]
}): Promise<Recommendation[]> {
  const { companyId, companies, contacts, deals, contracts, activities } = opts

  const targetCompanies = companyId
    ? companies.filter(c => c.id === companyId)
    : companies

  const contextLines: string[] = []

  for (const company of targetCompanies.slice(0, 10)) {
    const compDeals = deals.filter(d => d.company === company.name)
    const compContracts = contracts.filter(c => c.company === company.name)
    const compContacts = contacts.filter(c => c.companyName === company.name)
    const compActivities = activities.filter(a => a.companyName === company.name)
    const lastActivityDate = compActivities.length > 0
      ? compActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
      : null

    contextLines.push([
      `Company: ${company.name} (${company.status}, ${company.industry})`,
      `  Deals: ${compDeals.map(d => `${d.stage} $${d.value}`).join(', ') || 'none'}`,
      `  Contracts: ${compContracts.map(c => `${c.status} renews ${c.renewalDate}`).join(', ') || 'none'}`,
      `  Contacts: ${compContacts.map(c => c.fullName).join(', ') || 'none'}`,
      `  Last activity: ${lastActivityDate || 'never'}`,
      `  Total deal value: $${company.totalDealValue}`,
    ].join('\n'))
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return generateFallbackRecommendations(targetCompanies, deals, contracts, activities)
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicInsightsModel(),
        max_tokens: 1000,
        system: `You are a CRM intelligence assistant for a marketing agency. Analyze the data and return 3-5 actionable recommendations. Return ONLY valid JSON array, no markdown or explanation.

Each item must have: type (follow_up|upsell|at_risk|renewal_reminder|engagement_drop), priority (high|medium|low), title (short), description (1-2 sentences), suggestedAction (specific next step), companyName (if applicable).`,
        messages: [{
          role: 'user',
          content: `Analyze these accounts and provide recommendations:\n\n${contextLines.join('\n\n')}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`,
        }],
      }),
    })

    if (!res.ok) {
      return generateFallbackRecommendations(targetCompanies, deals, contracts, activities)
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const text = data.content.find(c => c.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Recommendation[]
      return parsed.slice(0, 5)
    }
  } catch {
    // fall through
  }

  return generateFallbackRecommendations(targetCompanies, deals, contracts, activities)
}

function generateFallbackRecommendations(
  companies: CompanyContext[],
  deals: DealContext[],
  contracts: ContractContext[],
  activities: ActivityContext[],
): Recommendation[] {
  const recs: Recommendation[] = []
  const now = Date.now()

  for (const contract of contracts) {
    const renewalDate = new Date(contract.renewalDate).getTime()
    const daysUntil = Math.floor((renewalDate - now) / 86400000)
    if (daysUntil > 0 && daysUntil <= 60 && contract.status === 'Fully Executed') {
      recs.push({
        type: 'renewal_reminder',
        priority: daysUntil <= 30 ? 'high' : 'medium',
        title: `${contract.company} renewal in ${daysUntil} days`,
        description: `Contract worth $${contract.value.toLocaleString()} is up for renewal on ${contract.renewalDate}.`,
        suggestedAction: 'Schedule a renewal discussion and prepare a retention proposal.',
        companyName: contract.company,
      })
    }
  }

  for (const company of companies) {
    const compActivities = activities.filter(a => a.companyName === company.name)
    if (compActivities.length > 0) {
      const latest = compActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
      const daysSince = Math.floor((now - new Date(latest.timestamp).getTime()) / 86400000)
      if (daysSince > 30 && company.status === 'Active Client') {
        recs.push({
          type: 'engagement_drop',
          priority: daysSince > 60 ? 'high' : 'medium',
          title: `No activity with ${company.name} in ${daysSince}d`,
          description: `This active client has had no logged interactions recently. Risk of disengagement.`,
          suggestedAction: 'Reach out with a check-in call or share relevant industry insights.',
          companyName: company.name,
        })
      }
    }
  }

  const staleDeals = deals.filter(d => {
    const daysSince = Math.floor((now - new Date(d.lastActivity).getTime()) / 86400000)
    return daysSince > 14 && !d.stage.startsWith('Closed')
  })
  for (const deal of staleDeals.slice(0, 2)) {
    recs.push({
      type: 'follow_up',
      priority: deal.value >= 10000 ? 'high' : 'medium',
      title: `Follow up on ${deal.company} deal`,
      description: `$${deal.value.toLocaleString()} deal in ${deal.stage} stage has gone quiet.`,
      suggestedAction: 'Send a personalized follow-up email and propose a next meeting.',
      companyName: deal.company,
    })
  }

  return recs.slice(0, 5)
}
