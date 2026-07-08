import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('integrations/mercury/test POST', async (req) => {
  const { apiKey: bodyKey } = await req.json().catch(() => ({ apiKey: undefined })) as { apiKey?: string }

  let apiKey = bodyKey

  if (!apiKey) {
    apiKey = process.env.MERCURY_API_KEY
  }

  if (!apiKey) {
    try {
      const db = createServiceClient()
      const { data } = await db
        .from('app_settings')
        .select('mercury')
        .eq('id', 'global')
        .maybeSingle()
      apiKey = (data?.mercury as { apiKey?: string })?.apiKey || undefined
    } catch { /* no stored key */ }
  }

  if (!apiKey) {
    return NextResponse.json({ connected: false, error: 'No API key provided' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.mercury.com/api/v1/accounts', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({ connected: true, accountCount: data.accounts?.length ?? 0 })
    }

    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { connected: false, error: `Mercury responded with ${res.status}: ${text}` },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ connected: false, error: message })
  }
})
