import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, createGoogleEvent, type CalendarSettings } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const bookingTypeId = searchParams.get('booking_type_id')
  const date = searchParams.get('date')
  const slug = searchParams.get('slug')

  const db = createServiceClient()

  if (slug && date) {
    const { data: bt } = await db
      .from('booking_types')
      .select('id, duration_minutes, buffer_minutes, availability, active')
      .eq('slug', slug)
      .eq('active', true)
      .single()

    if (!bt) {
      return NextResponse.json({ error: 'Booking type not found' }, { status: 404 })
    }

    const availability = bt.availability as { days: number[]; start: string; end: string }
    const [y, m, d] = date.split('-').map(Number)
    const dayOfWeek = new Date(y, m - 1, d).getDay()

    if (!availability.days.includes(dayOfWeek)) {
      return NextResponse.json({ slots: [] })
    }

    const { data: existingBookings } = await db
      .from('booking_type_bookings')
      .select('start_time, end_time')
      .eq('booking_type_id', bt.id)
      .eq('date', date)
      .eq('status', 'confirmed')

    const [startH, startM] = availability.start.split(':').map(Number)
    const [endH, endM] = availability.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const duration = bt.duration_minutes
    const buffer = bt.buffer_minutes

    const slots: { start: string; end: string; label: string }[] = []
    const todayStr = new Date().toISOString().split('T')[0]
    const nowMinutes = date === todayStr ? new Date().getHours() * 60 + new Date().getMinutes() + 30 : 0

    for (let min = startMinutes; min + duration <= endMinutes; min += duration + buffer) {
      if (min < nowMinutes) continue

      const slotStart = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
      const slotEndMin = min + duration
      const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`

      const conflict = existingBookings?.some(b => {
        const [bsh, bsm] = b.start_time.split(':').map(Number)
        const [beh, bem] = b.end_time.split(':').map(Number)
        const bStart = bsh * 60 + bsm
        const bEnd = beh * 60 + bem
        return min < bEnd && slotEndMin > bStart
      })

      if (!conflict) {
        const h = Math.floor(min / 60)
        const m = min % 60
        const period = h < 12 ? 'AM' : 'PM'
        const hr = h % 12 === 0 ? 12 : h % 12
        slots.push({
          start: slotStart,
          end: slotEnd,
          label: `${hr}:${String(m).padStart(2, '0')} ${period}`,
        })
      }
    }

    return NextResponse.json({ slots })
  }

  let query = db
    .from('booking_type_bookings')
    .select('*, booking_types(name, slug, color, location, duration_minutes)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (bookingTypeId) query = query.eq('booking_type_id', bookingTypeId)

  const { data, error } = await query
  if (error) {
    console.error('[calendar/bookings GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { slug, date, start_time, end_time, guest_name, guest_email, guest_phone, guest_company, notes } = body

  if (!slug || !date || !start_time || !end_time || !guest_name?.trim() || !guest_email?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: bt } = await db
    .from('booking_types')
    .select('id, active')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!bt) {
    return NextResponse.json({ error: 'Booking type not found or inactive' }, { status: 404 })
  }

  const { data: conflict } = await db
    .from('booking_type_bookings')
    .select('id')
    .eq('booking_type_id', bt.id)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lte('start_time', end_time)
    .gte('end_time', start_time)

  if (conflict && conflict.length > 0) {
    return NextResponse.json({ error: 'Time slot is no longer available' }, { status: 409 })
  }

  const { data, error } = await db
    .from('booking_type_bookings')
    .insert({
      booking_type_id: bt.id,
      date,
      start_time,
      end_time,
      guest_name: guest_name.trim(),
      guest_email: guest_email.trim(),
      guest_phone: guest_phone?.trim() || null,
      guest_company: guest_company?.trim() || null,
      notes: notes?.trim() || null,
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) {
    console.error('[calendar/bookings POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data) {
    try {
      const { data: allCals } = await db
        .from('calendar_settings')
        .select('*')
        .not('google_refresh_token', 'is', null)
        .limit(1)

      const cal = allCals?.[0]
      if (cal) {
        const accessToken = await getValidAccessToken(cal as CalendarSettings)
        if (accessToken) {
          const btName = bt ? (await db.from('booking_types').select('name').eq('id', bt.id).single()).data?.name : null
          const result = await createGoogleEvent(accessToken, {
            summary: `${btName ?? 'Meeting'} — ${guest_name}`,
            description: notes || 'Booked via GravHub',
            dateTimeStart: `${date}T${start_time}`,
            dateTimeEnd: `${date}T${end_time}`,
            timezone: cal.timezone || 'America/Chicago',
            attendeeEmail: guest_email,
            attendeeName: guest_name,
          })
          await db.from('booking_type_bookings').update({
            google_event_id: result.eventId,
            meet_link: result.meetLink,
          }).eq('id', data.id)
          data.google_event_id = result.eventId
          data.meet_link = result.meetLink
        }
      }
    } catch (e) {
      console.error('[calendar/bookings POST] Google Calendar event creation failed:', e)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
