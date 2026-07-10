import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('wordpress/seo/sync POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = await req.json()
  const { siteUrl } = body as { siteUrl?: string }

  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: settings } = await db
    .from('app_settings')
    .select('wordpress')
    .eq('id', 'global')
    .maybeSingle()

  const wp = settings?.wordpress as { apiKeys?: Array<string | { key: string }> } | null
  const candidateKeys = (wp?.apiKeys ?? [])
    .map(k => (typeof k === 'string' ? k : k.key))
    .filter((k): k is string => !!k)
  if (process.env.WORDPRESS_API_KEY) candidateKeys.push(process.env.WORDPRESS_API_KEY)

  if (candidateKeys.length === 0) {
    throw new Error('No WordPress API key configured')
  }

  const base = siteUrl.replace(/\/+$/, '')

  try {
    // The site only accepts the specific key configured in its own plugin
    // settings — with multiple keys now possible (one per site), don't
    // assume index 0 is the right one. Try each until the site accepts one.
    let apiKey: string | null = null
    let status: unknown = null
    let lastErrorStatus = 0

    for (const candidate of candidateKeys) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const heartbeat = await fetch(`${base}/wp-json/gravhub-seo/v1/heartbeat`, {
        headers: { 'X-GravHub-Key': candidate },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (heartbeat.ok) {
        apiKey = candidate
        status = await heartbeat.json()
        break
      }
      lastErrorStatus = heartbeat.status
    }

    if (!apiKey) {
      return NextResponse.json({
        connected: false,
        error: candidateKeys.length > 1
          ? `Plugin rejected all ${candidateKeys.length} configured API keys (last: HTTP ${lastErrorStatus}). Check which key is actually saved in the plugin's settings on the site.`
          : `Plugin returned HTTP ${lastErrorStatus}`,
      })
    }

    const syncController = new AbortController()
    const syncTimeout = setTimeout(() => syncController.abort(), 60000)
    const syncRes = await fetch(`${base}/wp-json/gravhub-seo/v1/remote-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GravHub-Key': apiKey,
      },
      signal: syncController.signal,
    })
    clearTimeout(syncTimeout)

    const syncData = syncRes.ok ? await syncRes.json() : null

    return NextResponse.json({
      connected: true,
      status,
      sync: syncData,
    })
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    })
  }
})
