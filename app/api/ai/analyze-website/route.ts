import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 502 })
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text ?? ''

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
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
  } catch (error) {
    console.error('analyze-website error:', error)
    return NextResponse.json({ error: 'Failed to analyze website' }, { status: 500 })
  }
}
