import { NextResponse } from 'next/server'
import { googleMarketingAuthUrl } from '@/lib/google-marketing'
import { withErrorHandler } from '@/lib/api-handler'
import { issueOAuthState } from '@/lib/oauth-state'

/**
 * GET /api/integrations/google-marketing/connect
 * Redirects the browser to Google's consent screen. A single flow grants
 * access to GSC, GA4, Ads, and Business Profile.
 */
export const GET = withErrorHandler('integrations/google-marketing/connect GET', async () => {
  const { state, setCookie } = issueOAuthState('google-marketing')
  const url = googleMarketingAuthUrl(state)
  return setCookie(NextResponse.redirect(url))
})
