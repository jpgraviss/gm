import { NextResponse } from 'next/server'
import { linkedinAuthUrl } from '@/lib/linkedin'

/**
 * GET /api/integrations/linkedin/connect
 * Redirects the browser to LinkedIn's OAuth consent screen.
 */
export async function GET() {
  try {
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
    return NextResponse.redirect(linkedinAuthUrl(state))
  } catch (err) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'
    const msg = err instanceof Error ? err.message : 'linkedin_not_configured'
    return NextResponse.redirect(`${appUrl}/social?li_err=${encodeURIComponent(msg)}`)
  }
}
