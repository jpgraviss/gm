import { NextRequest, NextResponse } from 'next/server'
import { exchangeMetaCode, upsertMetaIntegration } from '@/lib/meta-ads'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyOAuthState } from '@/lib/oauth-state'

/**
 * GET /api/integrations/meta/callback?code=...
 * Exchanges the Meta OAuth code for a long-lived token and upserts the
 * single meta_integration row for this workspace.
 */
export const GET = withErrorHandler('integrations/meta/callback GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  const { valid, clearCookie } = verifyOAuthState(req, 'meta', searchParams.get('state'))
  if (!valid) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&meta_err=invalid_state`))
  }

  if (err) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&meta_err=${encodeURIComponent(err)}`))
  }
  if (!code) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&meta_err=missing_code`))
  }

  try {
    const result = await exchangeMetaCode(code)
    await upsertMetaIntegration({
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      scopes: result.scopes,
      accountEmail: result.accountEmail,
    })

    logAudit({
      userName: 'system',
      action: 'meta_ads_connected',
      module: 'integrations',
      type: 'action',
      metadata: { accountEmail: result.accountEmail ?? null },
    })

    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&meta_ok=1`))
  } catch (exchangeErr) {
    console.error('[meta callback]', exchangeErr)
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&meta_err=exchange_failed`))
  }
})
