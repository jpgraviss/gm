import { NextRequest, NextResponse } from 'next/server'
import { googleMarketingAuthUrl } from '@/lib/google-marketing'
import { withErrorHandler } from '@/lib/api-handler'
import { issueOAuthState } from '@/lib/oauth-state'
import { requireRole } from '@/lib/rbac'

/**
 * GET /api/integrations/google-marketing/connect
 * Redirects the browser to Google's consent screen. A single flow grants
 * access to GSC, GA4, Ads, and Business Profile. This is a single
 * workspace-wide connection (like disconnect below, gated Leadership) —
 * previously any authenticated caller, including a portal client, could
 * complete OAuth with their own account and silently swap the org's
 * shared connection. The CSRF state cookie (AUDIT #84) only proves the
 * callback came from the same browser that started this flow — it says
 * nothing about the caller's role, so gating here is what actually
 * protects the whole flow.
 */
export const GET = withErrorHandler('integrations/google-marketing/connect GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { state, setCookie } = issueOAuthState('google-marketing')
  const url = googleMarketingAuthUrl(state)
  return setCookie(NextResponse.redirect(url))
})
