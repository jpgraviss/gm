import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeGoogleMarketingCode,
  upsertGoogleIntegration,
  SCOPES_PER_PRODUCT,
  type GoogleMarketingProduct,
} from '@/lib/google-marketing'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyOAuthState } from '@/lib/oauth-state'
import { getAuthUser } from '@/lib/rbac'

/**
 * OAuth callback. Exchanges the authorization code for tokens, introspects
 * the granted scopes, and writes one row per product that the user actually
 * consented to. Missing scopes simply don't get rows (no error).
 */
export const GET = withErrorHandler('integrations/google-marketing/callback GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  const { valid, clearCookie } = verifyOAuthState(req, 'google-marketing', searchParams.get('state'))
  if (!valid) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_err=invalid_state`))
  }

  if (err) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_err=${encodeURIComponent(err)}`))
  }
  if (!code) {
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_err=missing_code`))
  }

  try {
    const token = await exchangeGoogleMarketingCode(code)
    const grantedScopes = (token.scope ?? '').split(' ').filter(Boolean)
    const expiresAt = new Date(Date.now() + token.expires_in * 1000)

    // Pull the signed-in Google account email (for display)
    let accountEmail: string | undefined
    try {
      const userinfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      if (userinfo.ok) {
        const json = await userinfo.json() as { email?: string }
        accountEmail = json.email
      }
    } catch {/* non-blocking */}

    // Need refresh token to auto-refresh later
    if (!token.refresh_token) {
      return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_err=missing_refresh_token`))
    }

    // Write one row per product that was consented to
    const products: GoogleMarketingProduct[] = ['search_console', 'analytics', 'ads', 'business_profile']
    const connected: string[] = []
    for (const product of products) {
      const required = SCOPES_PER_PRODUCT[product]
      const hasAll = required.every((scope) => grantedScopes.includes(scope))
      if (hasAll) {
        await upsertGoogleIntegration(product, {
          accountEmail,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
          scopes: required,
          metadata: {},
        })
        connected.push(product)
      }
    }

    // /connect requires a Leadership session before issuing the OAuth
    // redirect, and the gravhub-auth cookie (sameSite lax) carries through
    // the provider's top-level-navigation redirect back to this callback,
    // so the initiating staff member's session is still resolvable here.
    const actor = await getAuthUser(req)

    logAudit({
      userName: actor?.name || actor?.email || 'system',
      action: 'google_marketing_connected',
      module: 'integrations',
      type: 'action',
      metadata: { connected, accountEmail },
    })

    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_ok=${connected.join(',')}`))
  } catch (exchangeErr) {
    console.error('[google-marketing callback]', exchangeErr)
    return clearCookie(NextResponse.redirect(`${appUrl}/settings?tab=integrations&google_err=exchange_failed`))
  }
})
