import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai-client'

type GenerationType = 'email_draft' | 'proposal_summary' | 'report_summary' | 'social_post' | 'follow_up'

const SYSTEM_PROMPTS: Record<GenerationType, string> = {
  email_draft: 'You are an expert email copywriter for a digital marketing agency (Graviss Marketing). Write professional, warm, and concise emails. Keep subject lines short and compelling. Format the output as:\n\nSubject: [subject line]\n\n[email body]',
  proposal_summary: 'You are a proposal writer for Graviss Marketing, a full-service digital marketing agency. Write compelling executive summaries that highlight value, outcomes, and ROI. Be specific and professional.',
  report_summary: 'You are a marketing analyst at Graviss Marketing. Write clear, data-driven report narratives that highlight trends, wins, and areas for improvement. Use specific numbers when provided.',
  social_post: 'You are a social media manager for Graviss Marketing. Write engaging social media posts that drive engagement. Include relevant hashtags. Keep posts concise and platform-appropriate.',
  follow_up: 'You are a sales representative at Graviss Marketing. Write personalized follow-up messages that reference previous interactions and provide clear next steps. Be professional but personable.',
}

export async function POST(req: NextRequest) {
  try {
    const { type, context } = await req.json() as { type: GenerationType; context: Record<string, string> }

    if (!type || !SYSTEM_PROMPTS[type]) {
      return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 })
    }

    const userPrompt = buildUserPrompt(type, context)

    const result = await chatCompletion({
      system: SYSTEM_PROMPTS[type],
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 1500,
      timeoutMs: 30_000,
    })

    if (result.source === 'none') {
      return NextResponse.json({ content: generateFallback(type, context), source: 'template' })
    }

    return NextResponse.json({ content: result.text, source: result.source })
  } catch (err) {
    console.error('[ai/generate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildUserPrompt(type: GenerationType, ctx: Record<string, string>): string {
  switch (type) {
    case 'email_draft':
      return `Write a professional email.\n\nRecipient: ${ctx.recipient || 'client'}\nPurpose: ${ctx.purpose || 'general follow-up'}\nTone: ${ctx.tone || 'professional'}\n${ctx.additionalContext ? `Context: ${ctx.additionalContext}` : ''}`
    case 'proposal_summary':
      return `Write an executive summary for a proposal.\n\nClient: ${ctx.company || 'client'}\nServices: ${ctx.services || 'marketing services'}\nValue: ${ctx.value || 'TBD'}\n${ctx.additionalContext ? `Context: ${ctx.additionalContext}` : ''}`
    case 'report_summary':
      return `Write a monthly report narrative.\n\nClient: ${ctx.company || 'client'}\nPeriod: ${ctx.period || 'this month'}\nMetrics: ${ctx.metrics || 'general marketing metrics'}\n${ctx.highlights ? `Highlights: ${ctx.highlights}` : ''}`
    case 'social_post':
      return `Write a social media post.\n\nTopic: ${ctx.topic || 'marketing'}\nPlatform: ${ctx.platform || 'LinkedIn'}\n${ctx.url ? `Reference URL: ${ctx.url}` : ''}\n${ctx.additionalContext ? `Context: ${ctx.additionalContext}` : ''}`
    case 'follow_up':
      return `Write a follow-up message.\n\nRecipient: ${ctx.recipient || 'client'}\nCompany: ${ctx.company || ''}\nLast Interaction: ${ctx.lastInteraction || 'recent meeting'}\nGoal: ${ctx.goal || 'schedule next steps'}\n${ctx.additionalContext ? `Context: ${ctx.additionalContext}` : ''}`
    default:
      return ctx.additionalContext || 'Generate professional content.'
  }
}

function generateFallback(type: GenerationType, ctx: Record<string, string>): string {
  switch (type) {
    case 'email_draft':
      return `Subject: Following Up — ${ctx.purpose || 'Next Steps'}\n\nHi ${ctx.recipient || 'there'},\n\nI hope this message finds you well. I wanted to follow up regarding ${ctx.purpose || 'our recent conversation'}.\n\nPlease let me know if you have any questions or if there's anything I can help with.\n\nBest regards,\nGraviss Marketing Team`
    case 'proposal_summary':
      return `Executive Summary\n\nGraviss Marketing is pleased to present this proposal for ${ctx.company || 'your organization'}. Our team will deliver ${ctx.services || 'comprehensive marketing services'} designed to drive measurable results and accelerate growth.\n\nInvestment: ${ctx.value || 'See detailed pricing below'}`
    case 'report_summary':
      return `Monthly Report — ${ctx.period || 'This Month'}\n\nThis month showed continued progress across key marketing initiatives for ${ctx.company || 'the client'}. ${ctx.highlights || 'Key metrics have trended positively.'}`
    case 'social_post':
      return `${ctx.topic || 'Digital marketing'} is evolving fast. At Graviss Marketing, we help businesses stay ahead of the curve. ${ctx.url ? `Learn more: ${ctx.url}` : ''}\n\n#Marketing #DigitalMarketing #GrowthStrategy`
    case 'follow_up':
      return `Hi ${ctx.recipient || 'there'},\n\nGreat connecting with you recently about ${ctx.lastInteraction || 'your marketing goals'}. I wanted to follow up and see if you had any questions.\n\nWould you be available for a brief call this week to discuss next steps?\n\nBest,\nGraviss Marketing Team`
    default:
      return 'Content generation is currently unavailable. Please try again later.'
  }
}
