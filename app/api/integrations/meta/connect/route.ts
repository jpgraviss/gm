import { NextRequest, NextResponse } from 'next/server'
import { metaAuthUrl } from '@/lib/meta-ads'
import { withErrorHandler } from '@/lib/api-handler'
import { issueOAuthState } from '@/lib/oauth-state'
import { requireRole } from '@/lib/rbac'

/**
 * GET /api/integrations/meta/connect
 * Redirects the browser to Meta's OAuth consent screen. Single
 * workspace-wide connection — see matching comment on the
 * google-marketing/connect route for why this needs a role gate.
 */
export const GET = withErrorHandler('integrations/meta/connect GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const { state, setCookie } = issueOAuthState('meta')
  const url = metaAuthUrl(state)
  return setCookie(NextResponse.redirect(url))
})
