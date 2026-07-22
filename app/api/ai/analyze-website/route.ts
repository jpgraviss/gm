import { NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai-client'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { parseWebsiteUrl, fetchSafeHtml, htmlToText } from '@/lib/website-fetch'

const INDUSTRIES = [
  'OOH', 'Real Estate', 'Healthcare', 'Technology', 'Finance', 'Retail',
  'Education', 'Construction', 'Hospitality', 'Legal', 'Non-Profit', 'Other',
]

export const POST = withErrorHandler('ai/analyze-website POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { url: rawUrl } = await req.json()
  if (!rawUrl || typeof rawUrl !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const url = parseWebsiteUrl(rawUrl)
  if (!url) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // AUDIT — this route used to ask the model to "infer" industry, size, HQ,
  // annual revenue, and phone purely from "your knowledge of this
  // company/website" with no real page content at all: pure confabulation,
  // dressed up as enrichment, filling the exact same CRM fields as the
  // properly-grounded /api/crm/enrich flow (which actually fetches the
  // site). A fabricated annual revenue number could land in a real CRM
  // record with nothing distinguishing it from a verified figure. Now
  // shares the same SSRF-safe fetch as crm/enrich and only ever classifies
  // from the real fetched text — annualRevenue/hq/phone are dropped
  // entirely (crm/enrich's onBlur flow already fills phone/hq from real
  // extracted page data, which is strictly more trustworthy than a guess).
  const fetched = await fetchSafeHtml(url)
  if (!fetched.ok) {
    return NextResponse.json({ error: fetched.error }, { status: fetched.status })
  }
  const textContent = htmlToText(fetched.html)

  const result = await chatCompletion({
    system: 'You are a business analyst. Analyze real website content and return ONLY valid JSON, no markdown, no commentary.',
    messages: [{
      role: 'user',
      content: `Analyze this website's actual content and return a JSON object with:\n{\n  "industry": one of ${JSON.stringify(INDUSTRIES)},\n  "description": a 2-3 sentence company description grounded in the content below,\n  "size": one of "1-10", "11-50", "51-200", "201-500", "500+" (best estimate from the content; if there's no real signal, use "1-10")\n}\n\nWebsite URL: ${url.toString()}\nContent:\n${textContent}`,
    }],
    maxTokens: 400,
    fast: true,
    feature: 'analyze_website',
  })

  if (result.source === 'none') {
    return NextResponse.json({ error: 'No AI provider is configured' }, { status: 503 })
  }

  const jsonMatch = result.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 502 })
  }

  let parsed: { industry?: string; description?: string; size?: string }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 502 })
  }

  return NextResponse.json({
    industry: parsed.industry ?? '',
    description: parsed.description ?? '',
    size: parsed.size ?? '1-10',
  })
})
