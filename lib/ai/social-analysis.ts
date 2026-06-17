import { chatCompletion } from '@/lib/ai-client'

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

  try {
    const result = await chatCompletion({
      system: 'You are a social media analyst for a marketing agency. Analyze the social presence data and return JSON only. No markdown.',
      messages: [{
        role: 'user',
        content: `Company: ${companyName}\nSocial profiles found: ${JSON.stringify(socialUrls)}\n\nReturn a JSON object with:\n- "summary": 2-3 sentence analysis of their social presence\n- "engagementOpportunities": array of 3-4 specific, actionable suggestions for our agency to engage with this company through social channels`,
      }],
      maxTokens: 600,
      fast: true,
    })

    if (result.source !== 'none' && result.text) {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
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
