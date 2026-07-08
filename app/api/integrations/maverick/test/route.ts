import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('integrations/maverick/test POST', async (req) => {
  const { apiKey: bodyKey } = await req.json().catch(() => ({ apiKey: undefined })) as { apiKey?: string }

  let apiKey = bodyKey

  if (!apiKey) {
    apiKey = process.env.MAVERICK_API_KEY
  }

  if (!apiKey) {
    try {
      const db = createServiceClient()
      const { data } = await db
        .from('app_settings')
        .select('maverick')
        .eq('id', 'global')
        .maybeSingle()
      apiKey = (data?.maverick as { apiKey?: string })?.apiKey || undefined
    } catch { /* no stored key */ }
  }

  if (!apiKey) {
    return NextResponse.json({ connected: false, error: 'No API key provided' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api-v1.maverickintelligence.co/v1/stats', {
      headers: { 'X-API-Key': apiKey },
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ connected: true, stats: data.data ?? null })
    }

    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { connected: false, error: `Maverick responded with ${res.status}: ${text}` },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ connected: false, error: message })
  }
})
