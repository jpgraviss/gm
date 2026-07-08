import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  getValidAccessToken,
  listGoogleEventsIncremental,
  createGoogleEvent,
  type CalendarSettings,
} from '@/lib/google-calendar'
import { encrypt, decrypt } from '@/lib/encryption'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

export const POST = withErrorHandler('calendar/sync POST', async (req) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  if (!isCron) {
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied
  }

  const db = createServiceClient()

  const { data: allSettings } = await db
    .from('calendar_settings')
    .select('*')
    .not('google_refresh_token', 'is', null)

  if (!allSettings?.length) {
    return NextResponse.json({ message: 'No calendars connected' })
  }

  let synced = 0
  let pushed = 0
  let errors = 0

  for (const cal of allSettings) {
    try {
      const token = await getValidAccessToken(cal as CalendarSettings)
      if (!token) continue

      const timeMin = new Date(Date.now() - 30 * 86400000).toISOString()
      const timeMax = new Date(Date.now() + 90 * 86400000).toISOString()

      const decryptedSyncToken = cal.google_sync_token ? decrypt(cal.google_sync_token) : null
      const { events, nextSyncToken } = await listGoogleEventsIncremental(
        token,
        decryptedSyncToken,
        timeMin,
        timeMax,
      )

      if (nextSyncToken && nextSyncToken !== cal.google_sync_token) {
        await db.from('calendar_settings').update({
          google_sync_token: encrypt(nextSyncToken),
        }).eq('id', cal.id)
      }

      const { data: existingBookings } = await db
        .from('bookings')
        .select('id, google_event_id, date, start_time, end_time, status')
        .eq('calendar_slug', cal.slug)

      const bookingsByEventId = new Map(
        (existingBookings ?? [])
          .filter(b => b.google_event_id)
          .map(b => [b.google_event_id!, b])
      )

      for (const event of events) {
        const existing = bookingsByEventId.get(event.id)

        if (event.status === 'cancelled') {
          if (existing && existing.status !== 'cancelled') {
            await db.from('bookings').update({ status: 'cancelled' }).eq('id', existing.id)
            synced++
          }
          continue
        }

        const startTime = event.start?.dateTime || event.start?.date
        const endTime = event.end?.dateTime || event.end?.date
        if (!startTime || !endTime) continue

        const startDate = new Date(startTime)
        const endDate = new Date(endTime)
        const date = startDate.toISOString().split('T')[0]
        const startHHMM = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
        const endHHMM = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

        if (existing) {
          if (existing.date !== date || existing.start_time !== startHHMM || existing.end_time !== endHHMM) {
            await db.from('bookings').update({
              date,
              start_time: startHHMM,
              end_time: endHHMM,
              meet_link: event.hangoutLink || null,
            }).eq('id', existing.id)
            synced++
          }
        } else {
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
      }

      const { data: unpushed } = await db
        .from('bookings')
        .select('*')
        .eq('calendar_slug', cal.slug)
        .is('google_event_id', null)
        .eq('status', 'confirmed')

      for (const booking of unpushed ?? []) {
        try {
          const result = await createGoogleEvent(token, {
            summary: `${cal.title} — ${booking.client_name}${booking.client_company ? ` (${booking.client_company})` : ''}`,
            description: booking.notes || 'Booked via GravHub Scheduling',
            dateTimeStart: `${booking.date}T${booking.start_time}:00`,
            dateTimeEnd: `${booking.date}T${booking.end_time}:00`,
            timezone: cal.timezone || 'America/Chicago',
            attendeeEmail: booking.client_email,
            attendeeName: booking.client_name,
          })
          await db.from('bookings').update({
            google_event_id: result.eventId,
            meet_link: result.meetLink,
          }).eq('id', booking.id)
          pushed++
        } catch (e) {
          console.error(`[calendar/sync] Failed to push booking ${booking.id} to Google:`, e)
        }
      }

      const { data: unpushedTyped } = await db
        .from('booking_type_bookings')
        .select('*, booking_types(name, slug)')
        .is('google_event_id', null)
        .eq('status', 'confirmed')

      for (const tb of unpushedTyped ?? []) {
        try {
          const result = await createGoogleEvent(token, {
            summary: `${(tb.booking_types as { name: string } | null)?.name ?? 'Meeting'} — ${tb.guest_name}`,
            description: tb.notes || 'Booked via GravHub',
            dateTimeStart: `${tb.date}T${tb.start_time}`,
            dateTimeEnd: `${tb.date}T${tb.end_time}`,
            timezone: cal.timezone || 'America/Chicago',
            attendeeEmail: tb.guest_email,
            attendeeName: tb.guest_name,
          })
          await db.from('booking_type_bookings').update({
            google_event_id: result.eventId,
          }).eq('id', tb.id)
          pushed++
        } catch (e) {
          console.error(`[calendar/sync] Failed to push booking_type_booking ${tb.id} to Google:`, e)
        }
      }
    } catch (err) {
      console.error(`[calendar/sync] Error syncing calendar ${cal.id}:`, err)
      errors++
    }
  }

  await db.from('app_settings').upsert({
    id: 'global',
    last_calendar_sync: new Date().toISOString(),
  }, { onConflict: 'id' })

  return NextResponse.json({ synced, pushed, errors, timestamp: new Date().toISOString() })
})
