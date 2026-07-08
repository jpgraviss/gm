import { NextResponse } from 'next/server'
import { linkedinAuthUrl } from '@/lib/linkedin'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/integrations/linkedin/connect
 * Redirects the browser to LinkedIn's OAuth consent screen.
 */
export const GET = withErrorHandler('integrations/linkedin/connect GET', async () => {
  try {
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
    return NextResponse.redirect(linkedinAuthUrl(state))
  } catch (err) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const msg = err instanceof Error ? err.message : 'linkedin_not_configured'
    return NextResponse.redirect(`${appUrl}/social?li_err=${encodeURIComponent(msg)}`)
  }
}
