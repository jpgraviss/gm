import { NextRequest, NextResponse } from 'next/server'
import { exchangeDriveCode, saveDriveConfig } from '@/lib/google-drive'
import { encrypt } from '@/lib/encryption'

// GET /api/drive/callback?code=...&state=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')
  const origin = req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=missing_code`)
  }

  try {
    const tokens = await exchangeDriveCode(code)

    await saveDriveConfig({
      google_drive_refresh_token: encrypt(tokens.refresh_token),
      google_drive_access_token:  encrypt(tokens.access_token),
      google_drive_token_expiry:  new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })

    return NextResponse.redirect(`${origin}/admin?tab=integrations&drive=connected`)
  } catch (err) {
    console.error('[drive/callback GET]', err)
    return NextResponse.redirect(`${origin}/admin?tab=integrations&drive=error&msg=token_exchange_failed`)
  }
}
