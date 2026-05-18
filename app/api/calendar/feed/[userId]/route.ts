import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateICS } from '@/lib/ics-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
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

  const { data: bookings } = await db
    .from('booking_type_bookings')
    .select('*, booking_types(name)')
    .eq('status', 'confirmed')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: true })

  const { data: legacyBookings } = await db
    .from('bookings')
    .select('*')
    .eq('calendar_slug', cal.slug)
    .eq('status', 'confirmed')
    .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
    .order('date', { ascending: true })

  const vevents: string[] = []

  for (const b of bookings ?? []) {
    const btName = (b.booking_types as { name: string } | null)?.name ?? 'Meeting'
    const ics = generateICS({
      title: `${btName} — ${b.guest_name}`,
      startDateTime: `${b.date}T${b.start_time}`,
      endDateTime: `${b.date}T${b.end_time}`,
      timezone: tz,
      description: b.notes || `${btName} — Booked via GravHub`,
      location: b.meet_link || '',
      organizerName,
      organizerEmail,
      attendeeEmail: b.guest_email,
      uid: `booking-${b.id}@gravhub`,
    })
    const vevent = ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/)
    if (vevent) vevents.push(vevent[0])
  }

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
}
