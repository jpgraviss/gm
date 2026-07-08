import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('intelligence/script GET', async (req) => {
  const siteId = new URL(req.url).searchParams.get('site') ?? 'default'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
  const endpoint = `${appUrl}/api/intelligence/track`

  let script: string
  try {
    script = readFileSync(join(process.cwd(), 'public', 'gi.js'), 'utf-8')
  } catch {
    return new NextResponse('Script not found', { status: 404 })
  }

  script = script.replace('__GI_ENDPOINT__', endpoint).replace('__GI_SITE_ID__', siteId)

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
