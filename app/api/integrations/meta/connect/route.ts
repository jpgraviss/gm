import { NextResponse } from 'next/server'
import { metaAuthUrl } from '@/lib/meta-ads'

/**
 * GET /api/integrations/meta/connect
 * Redirects the browser to Meta's OAuth consent screen.
 */
export async function GET() {
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
  const url = metaAuthUrl(state)
  return NextResponse.redirect(url)
}
