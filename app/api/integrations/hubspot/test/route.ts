import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('integrations/hubspot/test POST', async (req) => {
  const { apiKey: bodyKey } = await req.json().catch(() => ({ apiKey: undefined })) as { apiKey?: string }

  let apiKey = bodyKey

  if (!apiKey) {
    apiKey = process.env.HUBSPOT_API_KEY
  }

  if (!apiKey) {
    try {
      const db = createServiceClient()
      const { data } = await db
        .from('app_settings')
        .select('hubspot')
        .eq('id', 'global')
        .maybeSingle()
      apiKey = (data?.hubspot as { apiKey?: string })?.apiKey || undefined
    } catch { /* no stored key */ }
  }

  if (!apiKey) {
    return NextResponse.json({ connected: false, error: 'No API key provided' }, { status: 400 })
  }

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (res.ok) {
    return NextResponse.json({ connected: true })
  }

  const text = await res.text().catch(() => '')
  return NextResponse.json(
    { connected: false, error: `HubSpot responded with ${res.status}: ${text}` },
    { status: 200 },
  )
})
