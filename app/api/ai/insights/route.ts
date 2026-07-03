import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai-client'

export async function POST(req: NextRequest) {
  try {
    const { type, name, context } = await req.json() as {
      type: 'company' | 'contact'
      name: string
      context: string
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const systemPrompt = type === 'company'
      ? `You are a senior account strategist at Graviss Marketing, a full-service marketing agency specializing in outdoor advertising, websites, SEO, sales training, and digital marketing. Generate concise, actionable intelligence about a specific client company. ONLY reference facts from the provided data — never invent or assume information not present. Be specific and practical.`
      : `You are a senior relationship manager at Graviss Marketing. Generate concise, actionable intelligence about a specific client contact. ONLY reference facts from the provided data — never invent or assume information not present. Be specific and practical.`

    const userPrompt = `Generate a brief intelligence report for ${type === 'company' ? 'company' : 'contact'}: ${name}

Data from our CRM (use ONLY this information):
${context}

Provide exactly these four sections (use the exact headers). Every statement must be grounded in the data above — do not make up facts:

## ACCOUNT SUMMARY
2-3 sentence overview of ${name} and their relationship with Graviss Marketing based on the data.

## KEY TALKING POINTS
- 3-4 bullet points referencing specific facts from the data (deals, revenue, services, activity)

## POTENTIAL OPPORTUNITIES
- 2-3 specific upsell or expansion opportunities based on what services they currently use vs. what we offer

## NEXT BEST ACTION
One concrete recommended next step based on their current deal stage, last activity, or contract status (1-2 sentences).`

    const result = await chatCompletion({
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 800,
      fast: true,
    })

    if (result.source === 'none') {
      const fallback = generateTemplateFallback(type, name, context)
      return NextResponse.json({ insights: fallback, source: 'template' })
    }

    return NextResponse.json({ insights: result.text, source: result.source })
  } catch (err) {
    console.error('[ai/insights]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateTemplateFallback(type: 'company' | 'contact', name: string, context: string): string {
  const lines = context.split('\n').filter(Boolean)
  const industry = lines.find(l => l.startsWith('Industry:'))?.replace('Industry:', '').trim() ?? 'marketing services'
  const status = lines.find(l => l.startsWith('Status:') || l.startsWith('Stage:'))?.split(':')[1]?.trim() ?? 'active'
  const value = lines.find(l => l.includes('$'))?.trim() ?? ''

  if (type === 'company') {
    return `## ACCOUNT SUMMARY
${name} is a ${industry} company currently in ${status} status with Graviss Marketing. ${value ? `They represent ${value} in pipeline or contract value.` : 'They are a key relationship in our portfolio.'} Our engagement should focus on demonstrating ROI and deepening the relationship.

## KEY TALKING POINTS
- Position Graviss Marketing as a full-service growth partner, not just a vendor
- Highlight our track record in ${industry} and measurable results
- Emphasize our ability to scale services as their needs grow
- Reference similar clients we've helped in their industry or region

## POTENTIAL OPPORTUNITIES
- Website refresh or SEO audit if not already under contract
- Social media management or content marketing package
- Email marketing automation to complement existing campaigns

## NEXT BEST ACTION
Schedule a quarterly business review call to assess current satisfaction, identify gaps, and present one targeted upsell recommendation based on their recent activity.`
  } else {
    return `## ACCOUNT SUMMARY
${name} is a key contact at their organization and a relationship we should actively nurture. ${status ? `Their current status is ${status}.` : ''} Building trust with this individual is critical to retaining and growing the account.

## KEY TALKING POINTS
- Lead with results and metrics from work we've done for their company
- Acknowledge their specific role and frame our conversation around their goals
- Ask open-ended questions about upcoming initiatives and pain points
- Position yourself as a strategic resource, not just a service provider

## POTENTIAL OPPORTUNITIES
- Introduce them to additional services they may not be aware of
- Offer a complimentary audit or strategy session to add immediate value
- Explore whether they influence budgets in other departments

## NEXT BEST ACTION
Send a personalized follow-up email with a relevant case study or insight from their industry, then schedule a brief 20-minute strategy call within the next two weeks.`
  }
}
