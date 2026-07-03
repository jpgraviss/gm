import { chatCompletion } from '@/lib/ai-client'

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
  description?: string
  hq?: string
  size?: string
  annualRevenue?: number
}

interface ContactContext {
  fullName: string
  companyName: string
  title?: string
  lastActivity?: string
  lifecycleStage?: string
}

interface DealContext {
  company: string
  stage: string
  value: number
  lastActivity: string
  serviceType?: string
  closeDate?: string
  probability?: number
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
  title?: string
  timestamp: string
}

function buildSingleCompanyContext(
  company: CompanyContext,
  contacts: ContactContext[],
  deals: DealContext[],
  contracts: ContractContext[],
  activities: ActivityContext[],
): string {
  const lines: string[] = []

  lines.push(`COMPANY: ${company.name}`)
  lines.push(`  Status: ${company.status}`)
  if (company.industry) lines.push(`  Industry: ${company.industry}`)
  if (company.hq) lines.push(`  Location: ${company.hq}`)
  if (company.size) lines.push(`  Size: ${company.size} employees`)
  if (company.annualRevenue) lines.push(`  Annual Revenue: $${company.annualRevenue.toLocaleString()}`)
  if (company.description) lines.push(`  Description: ${company.description}`)
  lines.push(`  Account Owner: ${company.owner}`)
  lines.push(`  Total Deal Value: $${company.totalDealValue.toLocaleString()}`)

  if (contacts.length > 0) {
    lines.push(`\n  CONTACTS (${contacts.length}):`)
    for (const c of contacts) {
      const parts = [`    - ${c.fullName}`]
      if (c.title) parts.push(`(${c.title})`)
      if (c.lifecycleStage) parts.push(`[${c.lifecycleStage}]`)
      if (c.lastActivity) parts.push(`last active: ${c.lastActivity}`)
      lines.push(parts.join(' '))
    }
  }

  if (deals.length > 0) {
    lines.push(`\n  DEALS (${deals.length}):`)
    for (const d of deals) {
      const parts = [`    - $${d.value.toLocaleString()} — ${d.stage}`]
      if (d.serviceType) parts.push(`(${d.serviceType})`)
      if (d.probability !== undefined) parts.push(`${d.probability}% probability`)
      if (d.closeDate) parts.push(`close: ${d.closeDate}`)
      if (d.lastActivity) parts.push(`last activity: ${d.lastActivity}`)
      lines.push(parts.join(' | '))
    }
  }

  if (contracts.length > 0) {
    lines.push(`\n  CONTRACTS (${contracts.length}):`)
    for (const c of contracts) {
      lines.push(`    - $${c.value.toLocaleString()} — ${c.status} | renews: ${c.renewalDate || 'N/A'}`)
    }
  }

  if (activities.length > 0) {
    lines.push(`\n  RECENT ACTIVITY (last ${activities.length}):`)
    for (const a of activities.slice(0, 10)) {
      const parts = [`    - ${a.type}`]
      if (a.title) parts.push(`"${a.title}"`)
      if (a.contactName) parts.push(`with ${a.contactName}`)
      if (a.timestamp) parts.push(`on ${a.timestamp.split('T')[0]}`)
      lines.push(parts.join(' '))
    }
  }

  return lines.join('\n')
}

export async function getRecommendations(opts: {
  companyId?: string
  companies: CompanyContext[]
  contacts: ContactContext[]
  deals: DealContext[]
  contracts: ContractContext[]
  activities: ActivityContext[]
}): Promise<Recommendation[]> {
  const { companyId, companies, contacts, deals, contracts: contractList, activities } = opts

  const targetCompanies = companyId
    ? companies.filter(c => c.id === companyId)
    : companies

  if (targetCompanies.length === 0) return []

  const isSingleCompany = targetCompanies.length === 1
  const contextLines: string[] = []

  for (const company of targetCompanies.slice(0, 10)) {
    const compDeals = deals.filter(d => d.company === company.name)
    const compContracts = contractList.filter(c => c.company === company.name)
    const compContacts = contacts.filter(c => c.companyName === company.name)
    const compActivities = activities.filter(a => a.companyName === company.name)

    contextLines.push(buildSingleCompanyContext(company, compContacts, compDeals, compContracts, compActivities))
  }

  const systemPrompt = isSingleCompany
    ? `You are a senior account strategist at Graviss Marketing, a full-service marketing agency specializing in outdoor advertising, websites, SEO, and sales training. You are analyzing a SPECIFIC client account. Your recommendations must be directly relevant to THIS company's actual data — their deals, contracts, contacts, and activity history. Do not make generic suggestions. Every recommendation must reference specific facts from the data provided.

Return ONLY a valid JSON array with 3-5 items, no markdown or explanation.
Each item: { "type": "follow_up"|"upsell"|"at_risk"|"renewal_reminder"|"engagement_drop", "priority": "high"|"medium"|"low", "title": "short title", "description": "1-2 sentences referencing specific data", "suggestedAction": "specific actionable next step", "companyName": "${targetCompanies[0].name}" }`
    : `You are a CRM intelligence assistant for Graviss Marketing. Analyze the data and return 3-5 actionable recommendations. Return ONLY valid JSON array, no markdown or explanation.

Each item must have: type (follow_up|upsell|at_risk|renewal_reminder|engagement_drop), priority (high|medium|low), title (short), description (1-2 sentences), suggestedAction (specific next step), companyName (required).`

  const userPrompt = isSingleCompany
    ? `Analyze this account and provide 3-5 specific, actionable recommendations based ONLY on the data below. Do NOT invent facts not present in the data.\n\n${contextLines[0]}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`
    : `Analyze these accounts and provide recommendations:\n\n${contextLines.join('\n\n')}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`

  try {
    const result = await chatCompletion({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1200,
      fast: true,
    })

    if (result.source !== 'none' && result.text) {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Recommendation[]
        if (isSingleCompany) {
          return parsed
            .filter(r => !r.companyName || r.companyName === targetCompanies[0].name)
            .slice(0, 5)
        }
        return parsed.slice(0, 5)
      }
    }
  } catch {
    // fall through to fallback
  }

  return generateFallbackRecommendations(targetCompanies, deals, contractList, activities)
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
    const companyMatch = companies.find(c => c.name === contract.company)
    if (!companyMatch) continue
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
          title: `No activity with ${company.name} in ${daysSince} days`,
          description: `This active client has had no logged interactions recently. Risk of disengagement.`,
          suggestedAction: 'Reach out with a check-in call or share relevant industry insights.',
          companyName: company.name,
        })
      }
    }

    const compDeals = deals.filter(d => d.company === company.name)
    const staleDeals = compDeals.filter(d => {
      const daysSince = Math.floor((now - new Date(d.lastActivity).getTime()) / 86400000)
      return daysSince > 14 && !d.stage.startsWith('Closed')
    })
    for (const deal of staleDeals.slice(0, 1)) {
      recs.push({
        type: 'follow_up',
        priority: deal.value >= 10000 ? 'high' : 'medium',
        title: `Follow up on $${deal.value.toLocaleString()} deal`,
        description: `Deal in "${deal.stage}" stage has gone quiet${deal.serviceType ? ` (${deal.serviceType})` : ''}.`,
        suggestedAction: 'Send a personalized follow-up email and propose a next meeting.',
        companyName: company.name,
      })
    }
  }

  return recs.slice(0, 5)
}
