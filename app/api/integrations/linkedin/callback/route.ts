import { NextRequest, NextResponse } from 'next/server'
import { exchangeLinkedInCode } from '@/lib/linkedin'
import { saveConnection } from '@/lib/social-connections'
import { logAudit } from '@/lib/audit'

/**
 * GET /api/integrations/linkedin/callback?code=...
 * Exchanges the code, resolves the member URN, and stores it as the LinkedIn
 * connection in social_connections.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  if (err) {
    return NextResponse.redirect(`${appUrl}/social?li_err=${encodeURIComponent(err)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/social?li_err=missing_code`)
  }

  try {
    const result = await exchangeLinkedInCode(code)
    await saveConnection({
      platform: 'linkedin',
      externalId: result.authorUrn,
      accountLabel: result.displayName,
      token: result.accessToken,
    })
    logAudit({ userName: 'system', action: 'linkedin_connected', module: 'integrations', type: 'action', metadata: { author: result.displayName } })
    return NextResponse.redirect(`${appUrl}/social?li_ok=1`)
  } catch (exchangeErr) {
    console.error('[linkedin callback]', exchangeErr)
    return NextResponse.redirect(`${appUrl}/social?li_err=exchange_failed`)
  }
}
