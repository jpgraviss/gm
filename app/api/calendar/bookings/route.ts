import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, getGoogleBusySlots, createGoogleEvent, type CalendarSettings } from '@/lib/google-calendar'
import { generateICS } from '@/lib/ics-generator'
import { getGoogleCalendarLink, getOutlookCalendarLink, getOutlook365CalendarLink } from '@/lib/calendar-links'
import { getResend } from '@/lib/resend'
import { getSettings } from '@/lib/settings'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { nowInZone } from '@/lib/timezone'

export const GET = withErrorHandler('calendar/bookings GET', async (req) => {
  const { searchParams } = new URL(req.url)
  const bookingTypeId = searchParams.get('booking_type_id')
  const date = searchParams.get('date')
  const slug = searchParams.get('slug')

  const db = createServiceClient()

  if (slug && date) {
    // Public slot-availability check (the /go/book/[slug] page) — no auth,
    // matches the older /api/calendar/slots route's public nature.
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

    // Fetch imported calendar events (external subscriptions) for the same
    // date — scoped to calendar_slug='imported' (the fixed bucket every
    // ICS/subscription import writes to), not every booking org-wide.
    // Previously had no calendar_slug filter at all, so any staff member's
    // unrelated personal /book/[slug] meeting blocked every booking type's
    // availability for that whole date.
    const { data: importedEvents } = await db
      .from('bookings')
      .select('start_time, end_time')
      .eq('calendar_slug', 'imported')
      .eq('date', date)
      .eq('status', 'confirmed')

    // Booking types have no timezone of their own — fall back to the
    // connected staff Google Calendar's timezone (same source the busy-
    // slot check below already uses), or America/Chicago if none connected.
    let tz = 'America/Chicago'
    const { data: allCals } = await db
      .from('calendar_settings')
      .select('*')
      .not('google_refresh_token', 'is', null)
      .limit(1)
    const cal = allCals?.[0]
    if (cal?.timezone) tz = cal.timezone

    // Fetch Google Calendar busy slots
    let googleBusyMinutes: { start: number; end: number }[] = []
    try {
      if (cal) {
        const accessToken = await getValidAccessToken(cal as CalendarSettings)
        if (accessToken) {
          const busySlots = await getGoogleBusySlots(accessToken, date, tz)
          googleBusyMinutes = busySlots.map(b => {
            const fmt = (iso: string) => {
              const local = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
              }).format(new Date(iso)).replace(/^24/, '00')
              const [h, m] = local.split(':').map(Number)
              return h * 60 + m
            }
            return { start: fmt(b.start), end: fmt(b.end) }
          })
        }
      }
    } catch (e) {
      console.error('[calendar/bookings GET] Google Calendar busy check failed:', e)
    }

    const [startH, startM] = availability.start.split(':').map(Number)
    const [endH, endM] = availability.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const duration = bt.duration_minutes
    const buffer = bt.buffer_minutes

    // "Now"/"today" must be read in the calendar's own timezone, not
    // server-local (UTC on Vercel) — same bug class as AUDIT #97, missed
    // there since this newer /go/book flow wasn't in that pass's scope.
    const slots: { start: string; end: string; label: string }[] = []
    const { date: todayStr, minutes: nowMinutesInZone } = nowInZone(tz)
    const nowMinutes = date === todayStr ? nowMinutesInZone + 30 : 0

    for (let min = startMinutes; min + duration <= endMinutes; min += duration + buffer) {
      if (min < nowMinutes) continue

      const slotStart = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
      const slotEndMin = min + duration
      const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`

      const hasBookingConflict = (bookings: { start_time: string; end_time: string }[] | null) =>
        bookings?.some(b => {
          const [bsh, bsm] = b.start_time.split(':').map(Number)
          const [beh, bem] = b.end_time.split(':').map(Number)
          const bStart = bsh * 60 + bsm
          const bEnd = beh * 60 + bem
          return min < bEnd && slotEndMin > bStart
        })

      const conflict = hasBookingConflict(existingBookings)
        || hasBookingConflict(importedEvents)
        || googleBusyMinutes.some(b => min < b.end && slotEndMin > b.start)

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

    return NextResponse.json({ slots, timezone: tz })
  }

  // Below this point is the internal staff listing (no slug/date) — this
  // whole route is in proxy.ts's public prefix list for the slot-check
  // path above, so this branch needs its own auth check.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  let query = db
    .from('booking_type_bookings')
    .select('*, booking_types(name, slug, color, location, duration_minutes)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (bookingTypeId) query = query.eq('booking_type_id', bookingTypeId)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(data)
})

export const POST = withErrorHandler('calendar/bookings POST', async (req) => {
  const body = await req.json()
  const { slug, date, start_time, end_time, guest_name, guest_email, guest_phone, guest_company, notes, intake_answers } = body

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
      intake_answers: intake_answers ?? {},
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
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

    try {
      const btName = (await db.from('booking_types').select('name').eq('id', bt.id).single()).data?.name ?? 'Meeting'
      const { data: calForEmail } = await db
        .from('calendar_settings')
        .select('user_name, user_email, timezone')
        .limit(1)
        .single()

      const organizerName = calForEmail?.user_name ?? 'Graviss Marketing'
      const organizerEmail = calForEmail?.user_email ?? 'info@gravissmarketing.com'
      const tz = calForEmail?.timezone ?? 'America/Chicago'
      const meetLink = data.meet_link || ''
      const eventTitle = `${btName} with Graviss Marketing`

      const calEvent = {
        title: eventTitle,
        startDateTime: `${date}T${start_time}`,
        endDateTime: `${date}T${end_time}`,
        timezone: tz,
        description: `${btName} — Booked via GravHub${meetLink ? `\n\nJoin: ${meetLink}` : ''}`,
        location: meetLink,
      }

      const googleLink = getGoogleCalendarLink(calEvent)
      const outlookLink = getOutlookCalendarLink(calEvent)
      const outlook365Link = getOutlook365CalendarLink(calEvent)
      const icsDownloadUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/calendar/bookings/${data.id}/ics`

      const icsContent = generateICS({
        ...calEvent,
        organizerName,
        organizerEmail,
        attendeeEmail: guest_email,
        uid: `booking-${data.id}@gravhub`,
      })

      const dateObj = new Date(`${date}T12:00:00`)
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
      const [sh, sm] = start_time.split(':').map(Number)
      const period = sh < 12 ? 'AM' : 'PM'
      const hr = sh % 12 === 0 ? 12 : sh % 12
      const formattedTime = `${hr}:${String(sm).padStart(2, '0')} ${period}`

      const appSettings = await getSettings()
      const fromEmail = `${appSettings.email.fromName} <${appSettings.email.fromEmail}>`

      const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#012b1e;padding:32px 32px 24px;">
    <div style="font-size:11px;font-weight:700;color:#ffffff;letter-spacing:2px;">GRAVISS</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.4);letter-spacing:2px;">MARKETING</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <div style="width:56px;height:56px;background:#e6f4ed;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
      <div style="width:24px;height:24px;color:#015035;font-size:24px;text-align:center;line-height:24px;">&#10003;</div>
    </div>
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;text-align:center;">You're booked!</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;">Your meeting has been confirmed.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">What</div>
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:16px;">${btName}</div>
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">When</div>
        <div style="font-size:14px;color:#111827;margin-bottom:2px;">${formattedDate}</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">${formattedTime} (${tz})</div>
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Host</div>
        <div style="font-size:14px;color:#111827;">${organizerName}</div>
      </td></tr>
    </table>

    ${meetLink ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <a href="${meetLink}" style="display:inline-block;background:#012b1e;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;">Join Google Meet</a>
      </td></tr>
    </table>
    ` : ''}

    <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:12px;">Add to Calendar</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 4px 8px 0;"><a href="${googleLink}" style="display:block;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;text-decoration:none;font-size:12px;font-weight:600;color:#374151;text-align:center;">Google Calendar</a></td>
        <td style="padding:0 4px 8px;"><a href="${outlookLink}" style="display:block;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;text-decoration:none;font-size:12px;font-weight:600;color:#374151;text-align:center;">Outlook</a></td>
        <td style="padding:0 0 8px 4px;"><a href="${icsDownloadUrl}" style="display:block;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;text-decoration:none;font-size:12px;font-weight:600;color:#374151;text-align:center;">Apple / iCal</a></td>
      </tr>
      <tr>
        <td colspan="3" style="padding:0 0 0 0;"><a href="${outlook365Link}" style="display:block;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;text-decoration:none;font-size:12px;font-weight:600;color:#374151;text-align:center;">Outlook 365</a></td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 24px;">
    <div style="border-top:1px solid #f3f4f6;padding-top:16px;text-align:center;">
      <div style="font-size:10px;color:#9ca3af;">Powered by</div>
      <div style="font-size:10px;font-weight:700;color:#015035;letter-spacing:2px;margin-top:2px;">GRAVISS MARKETING</div>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

      const resend = await getResend()
      await resend.emails.send({
        from: fromEmail,
        replyTo: appSettings.email.replyTo,
        to: [guest_email],
        subject: `Confirmed: ${btName} with Graviss Marketing`,
        html: emailHtml,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(icsContent).toString('base64'),
            contentType: 'text/calendar; method=REQUEST',
          },
        ],
      })
    } catch (emailErr) {
      console.error('[calendar/bookings POST] Confirmation email failed:', emailErr)
    }
  }

  return NextResponse.json(data, { status: 201 })
})
