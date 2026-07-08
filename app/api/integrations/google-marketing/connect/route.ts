import { NextResponse } from 'next/server'
import { googleMarketingAuthUrl } from '@/lib/google-marketing'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/google-marketing/connect
 * Redirects the browser to Google's consent screen. A single flow grants
 * access to GSC, GA4, Ads, and Business Profile.
 */
export const GET = withErrorHandler('integrations/google-marketing/connect GET', async () => {
  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
  const url = googleMarketingAuthUrl(state)
  return NextResponse.redirect(url)
})
