import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { siteUrl } = body as { siteUrl?: string }

  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: keys } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'wordpress_api_keys')
    .maybeSingle()

  const apiKey = Array.isArray((keys as { value: string[] } | null)?.value)
    ? (keys as { value: string[] }).value[0]
    : process.env.WORDPRESS_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'No WordPress API key configured' }, { status: 500 })
  }

  const base = siteUrl.replace(/\/+$/, '')

  // 1. Heartbeat — check if plugin is alive
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const heartbeat = await fetch(`${base}/wp-json/gravhub-seo/v1/heartbeat`, {
      headers: { 'X-GravHub-Key': apiKey },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!heartbeat.ok) {
      return NextResponse.json({
        connected: false,
        error: `Plugin returned HTTP ${heartbeat.status}`,
      })
    }

    const status = await heartbeat.json()

    // 2. Trigger remote sync
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
}
