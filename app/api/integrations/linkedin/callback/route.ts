import { NextRequest, NextResponse } from 'next/server'
import { exchangeLinkedInCode } from '@/lib/linkedin'
import { saveConnection } from '@/lib/social-connections'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyOAuthState } from '@/lib/oauth-state'
import { getAuthUser } from '@/lib/rbac'

/**
 * GET /api/integrations/linkedin/callback?code=...
 * Exchanges the code, resolves the member URN, and stores it as the LinkedIn
 * connection in social_connections.
 */
export const GET = withErrorHandler('integrations/linkedin/callback GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  const { valid, clearCookie } = verifyOAuthState(req, 'linkedin', searchParams.get('state'))
  if (!valid) {
    return clearCookie(NextResponse.redirect(`${appUrl}/social?li_err=invalid_state`))
  }

  if (err) {
    return clearCookie(NextResponse.redirect(`${appUrl}/social?li_err=${encodeURIComponent(err)}`))
  }
  if (!code) {
    return clearCookie(NextResponse.redirect(`${appUrl}/social?li_err=missing_code`))
  }

  try {
    const result = await exchangeLinkedInCode(code)
    await saveConnection({
      platform: 'linkedin',
      externalId: result.authorUrn,
      accountLabel: result.displayName,
      token: result.accessToken,
    })
    // /connect requires a Leadership session before issuing the OAuth
    // redirect, and the gravhub-auth cookie (sameSite lax) carries through
    // the provider's top-level-navigation redirect back to this callback,
    // so the initiating staff member's session is still resolvable here.
    const actor = await getAuthUser(req)
    logAudit({ userName: actor?.name || actor?.email || 'system', action: 'linkedin_connected', module: 'integrations', type: 'action', metadata: { author: result.displayName } })
    return clearCookie(NextResponse.redirect(`${appUrl}/social?li_ok=1`))
  } catch (exchangeErr) {
    console.error('[linkedin callback]', exchangeErr)
    return clearCookie(NextResponse.redirect(`${appUrl}/social?li_err=exchange_failed`))
  }
})
