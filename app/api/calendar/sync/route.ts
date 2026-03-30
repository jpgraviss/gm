import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, listGoogleEvents, type CalendarSettings } from '@/lib/google-calendar'

export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient()

    // Get all calendar settings with Google tokens
    const { data: settings } = await db
      .from('calendar_settings')
      .select('*')
      .not('google_refresh_token', 'is', null)

    if (!settings?.length) {
      return NextResponse.json({ message: 'No calendars connected' })
    }

    let synced = 0
    let errors = 0

    for (const cal of settings) {
      try {
        const token = await getValidAccessToken(cal as CalendarSettings)
        if (!token) continue

        // Sync window: 30 days back, 90 days forward
        const timeMin = new Date(Date.now() - 30 * 86400000).toISOString()
        const timeMax = new Date(Date.now() + 90 * 86400000).toISOString()

        const events = await listGoogleEvents(token, timeMin, timeMax)

        // Get existing bookings with google_event_id
        const { data: existingBookings } = await db
          .from('bookings')
          .select('id, google_event_id')
          .eq('calendar_slug', cal.slug)

        const existingEventIds = new Set(
          (existingBookings ?? []).map(b => b.google_event_id).filter(Boolean)
        )

        // Upsert events as bookings
        for (const event of events) {
          if (event.status === 'cancelled') continue
          if (existingEventIds.has(event.id)) continue

          const startTime = event.start?.dateTime || event.start?.date
          const endTime = event.end?.dateTime || event.end?.date
          if (!startTime || !endTime) continue

          // Parse date and time from ISO datetime
          const startDate = new Date(startTime)
          const endDate = new Date(endTime)
          const date = startDate.toISOString().split('T')[0]
          const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
          const endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

          await db.from('bookings').insert({
            calendar_slug: cal.slug,
            client_name: event.attendees?.[0]?.displayName || event.summary || 'Google Calendar Event',
            client_email: event.attendees?.[0]?.email || '',
            notes: event.description || null,
            date,
            start_time: startHHMM,
            end_time: endHHMM,
            timezone: cal.timezone || 'America/Chicago',
            google_event_id: event.id,
            meet_link: event.hangoutLink || null,
            status: 'confirmed',
          })
          synced++
        }
      } catch (err) {
        console.error(`[calendar/sync] Error syncing calendar ${cal.id}:`, err)
        errors++
      }
    }

    // Update last sync timestamp
    await db.from('app_settings').upsert({
      id: 'global',
      last_calendar_sync: new Date().toISOString(),
    }, { onConflict: 'id' })

    return NextResponse.json({ synced, errors, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[calendar/sync]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
