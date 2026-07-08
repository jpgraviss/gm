import { NextResponse } from 'next/server'
import { metaAuthUrl } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/meta/connect
 * Redirects the browser to Meta's OAuth consent screen.
 */
export const GET = withErrorHandler('integrations/meta/connect GET', async () => {
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
  const url = metaAuthUrl(state)
  return NextResponse.redirect(url)
})
