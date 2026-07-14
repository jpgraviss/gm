import { NextResponse } from 'next/server'
import { metaAuthUrl } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'
import { issueOAuthState } from '@/lib/oauth-state'

/**
 * GET /api/integrations/meta/connect
 * Redirects the browser to Meta's OAuth consent screen.
 */
export const GET = withErrorHandler('integrations/meta/connect GET', async () => {
  const { state, setCookie } = issueOAuthState('meta')
  const url = metaAuthUrl(state)
  return setCookie(NextResponse.redirect(url))
})
