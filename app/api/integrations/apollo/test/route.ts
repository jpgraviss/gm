import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { decrypt } from '@/lib/encryption'

export const POST = withErrorHandler('apollo/test POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { apiKey: bodyKey } = await req.json().catch(() => ({ apiKey: undefined })) as { apiKey?: string }

  let apiKey = bodyKey

  if (!apiKey) {
    apiKey = process.env.APOLLO_API_KEY
  }

  if (!apiKey) {
    try {
      const db = createServiceClient()
      const { data } = await db
        .from('app_settings')
        .select('apollo')
        .eq('id', 'global')
        .maybeSingle()
      const storedKey = (data?.apollo as { apiKey?: string })?.apiKey
      apiKey = storedKey ? decrypt(storedKey) : undefined
    } catch { /* no stored key */ }
  }

  if (!apiKey) {
    return NextResponse.json({ connected: false, error: 'No API key provided' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
    })

    if (res.ok) {
      return NextResponse.json({ connected: true })
    }

    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { connected: false, error: `Apollo responded with ${res.status}: ${text}` },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ connected: false, error: message })
  }
})
