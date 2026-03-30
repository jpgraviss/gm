import { NextRequest, NextResponse } from 'next/server'
import { createOAuthClient } from '@/lib/quickbooks'
import { createServiceClient } from '@/lib/supabase'

// GET /api/quickbooks/callback?code=...&state=...&realmId=...
// Handles Intuit OAuth redirect, stores tokens, redirects to settings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error   = searchParams.get('error')
  const origin  = req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${origin}/settings?tab=integrations&qb_error=${encodeURIComponent(error)}`)
  }

  if (!code || !realmId) {
    return NextResponse.redirect(`${origin}/settings?tab=integrations&qb_error=missing_params`)
  }

  // Basic parameter length validation to prevent abuse
  if (code.length > 512 || realmId.length > 64) {
    return NextResponse.redirect(`${origin}/settings?tab=integrations&qb_error=invalid_params`)
  }

  try {
    const client       = createOAuthClient()
    const authResponse = await client.createToken(req.url)
    const token        = authResponse.getToken()

    const db = createServiceClient()

    // Delete any existing config and store fresh tokens
    await db.from('quickbooks_config').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('quickbooks_config').insert({
      realm_id:         realmId,
      access_token:     token.access_token,
      refresh_token:    token.refresh_token,
      token_expires_at: new Date(Date.now() + (token.expires_in as number) * 1000).toISOString(),
    })

    return NextResponse.redirect(`${origin}/settings?tab=integrations&qb_connected=true`)
  } catch (err) {
    console.error('[quickbooks/callback GET]', err)
    return NextResponse.redirect(
      `${origin}/settings?tab=integrations&qb_error=connection_failed`,
    )
  }
}
