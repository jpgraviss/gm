import { NextResponse } from 'next/server'
import { getAuthorizationUrl, isQBConfigured } from '@/lib/quickbooks'

// GET /api/quickbooks/connect
// Redirects the browser to Intuit's OAuth consent screen
export async function GET() {
  if (!isQBConfigured()) {
    return NextResponse.json(
      { error: 'QB_CLIENT_ID and QB_CLIENT_SECRET must be set in environment variables' },
      { status: 500 },
    )
  }

  const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
  const url   = getAuthorizationUrl(state)

  return NextResponse.redirect(url)
}
