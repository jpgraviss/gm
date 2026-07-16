import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai-client'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const POST = withErrorHandler('ai/analyze-website POST', async (req) => {
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied

    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const prompt = `Analyze the website at this URL: ${url}

Based on the URL and your knowledge of this company/website, infer the following details. Respond ONLY with a JSON object (no markdown, no explanation, no code fences):

{
  "industry": one of: "OOH", "Real Estate", "Healthcare", "Technology", "Finance", "Retail", "Education", "Construction", "Hospitality", "Legal", "Non-Profit", "Other",
  "description": a 2-3 sentence company description,
  "size": one of: "1-10", "11-50", "51-200", "201-500", "500+",
  "hq": best guess city/state location (e.g. "Austin, TX"),
  "annualRevenue": estimated annual revenue as a number string (e.g. "5000000"), or empty string if unknown,
  "phone": phone number if known, or empty string
}`

    const result = await chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      fast: true,
    })

    if (result.source === 'none') {
      throw new Error('No AI provider configured')
    }

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 502 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      industry: parsed.industry ?? '',
      description: parsed.description ?? '',
      size: parsed.size ?? '1-10',
      hq: parsed.hq ?? '',
      annualRevenue: parsed.annualRevenue ?? '',
      phone: parsed.phone ?? '',
    })
})
