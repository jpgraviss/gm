import { anthropicInsightsModel } from '@/lib/anthropic'

export interface SocialAnalysisResult {
  platforms: {
    name: string
    url: string
    status: 'active' | 'inactive' | 'unknown'
    notes: string
  }[]
  summary: string
  engagementOpportunities: string[]
}

export async function analyzeSocialPresence(
  companyName: string,
  socialUrls: Record<string, string>,
): Promise<SocialAnalysisResult> {
  const platforms: SocialAnalysisResult['platforms'] = []

  for (const [name, url] of Object.entries(socialUrls)) {
    if (!url) continue
    platforms.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      url,
      status: 'active',
      notes: `Profile found at ${url}`,
    })
  }

  const commonPlatforms = ['linkedin', 'facebook', 'twitter', 'instagram']
  for (const p of commonPlatforms) {
    if (!socialUrls[p]) {
      platforms.push({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        url: '',
        status: 'inactive',
        notes: 'No profile detected',
      })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      platforms,
      summary: `${companyName} has ${Object.keys(socialUrls).length} detected social profiles. ${Object.keys(socialUrls).length === 0 ? 'No social presence detected — this represents an opportunity to help them build their digital footprint.' : `Active on ${Object.keys(socialUrls).join(', ')}.`}`,
      engagementOpportunities: [
        Object.keys(socialUrls).length === 0
          ? 'Propose a social media management package'
          : 'Engage with their content to build rapport',
        'Share relevant industry content they can reshare',
        'Monitor their social mentions for timely outreach',
      ],
    }
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
        max_tokens: 600,
        system: 'You are a social media analyst for a marketing agency. Analyze the social presence data and return JSON only. No markdown.',
        messages: [{
          role: 'user',
          content: `Company: ${companyName}\nSocial profiles found: ${JSON.stringify(socialUrls)}\n\nReturn a JSON object with:\n- "summary": 2-3 sentence analysis of their social presence\n- "engagementOpportunities": array of 3-4 specific, actionable suggestions for our agency to engage with this company through social channels`,
        }],
      }),
    })

    if (res.ok) {
      const data = await res.json() as { content: { type: string; text: string }[] }
      const text = data.content.find(c => c.type === 'text')?.text ?? ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { summary: string; engagementOpportunities: string[] }
        return {
          platforms,
          summary: parsed.summary,
          engagementOpportunities: parsed.engagementOpportunities?.slice(0, 4) ?? [],
        }
      }
    }
  } catch {
    // fall through
  }

  return {
    platforms,
    summary: `${companyName} has presence on ${Object.keys(socialUrls).length} social platforms.`,
    engagementOpportunities: [
      'Engage with their content to build rapport before outreach',
      'Share relevant industry content they can reshare',
      'Monitor their social mentions for timely outreach',
    ],
  }
}
