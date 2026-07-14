import { NextRequest, NextResponse } from 'next/server'
import { exchangeDriveCode, saveDriveConfig } from '@/lib/google-drive'
import { encrypt } from '@/lib/encryption'
import { withErrorHandler } from '@/lib/api-handler'
import { verifyOAuthState } from '@/lib/oauth-state'

// GET /api/drive/callback?code=...&state=...
export const GET = withErrorHandler('drive/callback GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const origin = req.nextUrl.origin

  const { valid, clearCookie } = verifyOAuthState(req, 'drive', searchParams.get('state'))
  if (!valid) {
    return clearCookie(NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=invalid_state`))
  }

  if (error) {
    return clearCookie(NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=${encodeURIComponent(error)}`))
  }
  if (!code) {
    return clearCookie(NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=missing_code`))
  }

  try {
    const tokens = await exchangeDriveCode(code)

    await saveDriveConfig({
      google_drive_refresh_token: encrypt(tokens.refresh_token),
      google_drive_access_token:  encrypt(tokens.access_token),
      google_drive_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })

    return clearCookie(NextResponse.redirect(`${origin}/admin?tab=integrations&drive=connected`))
  } catch (err) {
    console.error('[drive/callback GET]', err)
    return clearCookie(NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=token_exchange_failed`))
  }
})
