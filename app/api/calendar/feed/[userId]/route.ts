import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateICS } from '@/lib/ics-generator'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('calendar/feed/[userId] GET', async (_req, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params

  const db = createServiceClient()

  const { data: cal } = await db
    .from('calendar_settings')
    .select('*')
    .eq('id', userId)
    .single()

  if (!cal) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  const organizerName = cal.user_name ?? 'Graviss Marketing'
  const organizerEmail = cal.user_email ?? 'info@gravissmarketing.com'
  const tz = cal.timezone ?? 'America/Chicago'

  // AUDIT #231 — booking_types/booking_type_bookings have no per-staff
  // ownership column at all (confirmed via the create-booking flow,
  // app/api/calendar/bookings/route.ts: the Google Calendar event a new
  // booking syncs to is picked via `calendar_settings.limit(1)` — an
  // effectively arbitrary "first connected calendar," not this specific
  // staff member's). There is no correct way to attribute a new-flow
  // booking to one staff member's personal feed under the current data
  // model, so every staff member's "your iCal feed URL" was returning the
  // exact same full company-wide set of new-flow bookings — every
  // colleague's client meeting (guest name/email/phone/notes) leaking into
  // every other colleague's personal calendar subscription. Until a real
  // per-staff ownership model exists for booking types, new-flow bookings
  // are omitted from the personal feed entirely (a real, honest empty
  // result) rather than shown unscoped to everyone — the loop that used to
  // render them into vevents was removed along with the query.

  const { data: legacyBookings } = await db
    .from('bookings')
    .select('*')
    .eq('calendar_slug', cal.slug)
    .eq('status', 'confirmed')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: true })

  const vevents: string[] = []

  for (const b of legacyBookings ?? []) {
    const ics = generateICS({
      title: `${cal.title ?? 'Meeting'} — ${b.client_name}`,
      startDateTime: `${b.date}T${b.start_time}`,
      endDateTime: `${b.date}T${b.end_time}`,
      timezone: tz,
      description: b.notes || 'Booked via GravHub',
      location: b.meet_link || '',
      organizerName,
      organizerEmail,
      attendeeEmail: b.client_email,
      uid: `legacy-${b.id}@gravhub`,
    })
    const vevent = ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/)
    if (vevent) vevents.push(vevent[0])
  }

  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

  const feed = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GravHub//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:GravHub — ${organizerName}`,
    `X-WR-TIMEZONE:${tz}`,
    `DTSTAMP:${dtstamp}`,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n'

  return new NextResponse(feed, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
