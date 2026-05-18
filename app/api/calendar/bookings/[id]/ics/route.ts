import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateICS } from '@/lib/ics-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const db = createServiceClient()

  const { data: booking } = await db
    .from('booking_type_bookings')
    .select('*, booking_types(name)')
    .eq('id', id)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const btName = (booking.booking_types as { name: string } | null)?.name ?? 'Meeting'

  const { data: cal } = await db
    .from('calendar_settings')
    .select('user_email, user_name, timezone')
    .limit(1)
    .single()

  const organizerName = cal?.user_name ?? 'Graviss Marketing'
  const organizerEmail = cal?.user_email ?? 'info@gravissmarketing.com'
  const tz = cal?.timezone ?? 'America/Chicago'

  const icsContent = generateICS({
    title: `${btName} with Graviss Marketing`,
    startDateTime: `${booking.date}T${booking.start_time}`,
    endDateTime: `${booking.date}T${booking.end_time}`,
    timezone: tz,
    description: booking.notes || `${btName} — Booked via GravHub`,
    location: booking.meet_link || '',
    organizerName,
    organizerEmail,
    attendeeEmail: booking.guest_email,
    uid: `booking-${booking.id}@gravhub`,
  })

  return new NextResponse(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="booking.ics"`,
    },
  })
}
