import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/admin/integration-health
// Returns which integrations have valid stored credentials
export async function GET() {
  try {
    const db = createServiceClient()

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

    return NextResponse.json({ email, googleCalendar, googleDrive })
  } catch (err) {
    console.error('[admin/integration-health GET]', err)
    return NextResponse.json({ email: false, googleCalendar: false, googleDrive: false })
  }
}
