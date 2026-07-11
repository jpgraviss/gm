import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

// GET /api/admin/integration-health
// Returns which integrations have valid stored credentials, plus real
// database reachability and auth-signing-key configuration checks.
export const GET = withErrorHandler('admin/integration-health GET', async () => {
  const db = createServiceClient()

  // Database: a real round-trip query, not just "did the process start"
  let database = false
  try {
    const { error } = await db.from('app_settings').select('id').limit(1)
    database = !error
  } catch {
    database = false
  }

  // Authentication: the signed-cookie system is inert without this key —
  // in production lib/session-cookie.ts throws on every call if it's unset,
  // so its absence means auth is actually broken, not just "unconfigured"
  const auth = !!process.env.SESSION_SIGNING_KEY

  try {
    // Check email: RESEND_API_KEY env var
    const email = !!process.env.RESEND_API_KEY

    // Check Google Calendar: look for any row in calendar_settings with a refresh token
    let googleCalendar = false
    const { data: calRows } = await db
      .from('calendar_settings')
      .select('id')
      .not('google_refresh_token', 'is', null)
      .limit(1)
    if (calRows && calRows.length > 0) googleCalendar = true

    // Check Google Drive: look for drive config in app_settings
    let googleDrive = false
    const { data: appSettings } = await db
      .from('app_settings')
      .select('google_drive')
      .eq('id', 'global')
      .single()
    const driveConfig = (appSettings as Record<string, unknown>)?.google_drive as Record<string, unknown> | null
    if (driveConfig?.google_drive_refresh_token) googleDrive = true

    return NextResponse.json({ database, auth, email, googleCalendar, googleDrive })
  } catch (err) {
    console.error('[admin/integration-health GET]', err)
    return NextResponse.json({ database, auth, email: false, googleCalendar: false, googleDrive: false })
  }
})
