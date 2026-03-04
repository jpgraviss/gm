import { NextRequest, NextResponse } from 'next/server'

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

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fallback: return template-based insights without AI
      const fallback = generateTemplateFallback(type, name, context)
      return NextResponse.json({ insights: fallback, source: 'template' })
    }

    const systemPrompt = type === 'company'
      ? `You are a senior account strategist at a marketing agency. Generate concise, actionable sales intelligence about a client company. Be specific and practical.`
      : `You are a senior relationship manager at a marketing agency. Generate concise, actionable intelligence about a client contact. Be specific and practical.`

    const userPrompt = `Generate a brief intelligence report for ${type === 'company' ? 'company' : 'contact'}: ${name}

Available context:
${context}

Provide exactly these four sections (use the exact headers):

## ACCOUNT SUMMARY
2-3 sentence overview of the ${type} and their relationship with us.

## KEY TALKING POINTS
- 3-4 bullet points on what matters most to them / how to position our services

## POTENTIAL OPPORTUNITIES
- 2-3 specific upsell or expansion opportunities based on their profile

## NEXT BEST ACTION
One concrete recommended next step (1-2 sentences).`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[ai/insights] Anthropic API error:', err)
      const fallback = generateTemplateFallback(type, name, context)
      return NextResponse.json({ insights: fallback, source: 'template' })
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const text = data.content.find(c => c.type === 'text')?.text ?? ''
    return NextResponse.json({ insights: text, source: 'ai' })
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
