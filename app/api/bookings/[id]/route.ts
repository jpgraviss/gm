import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, deleteGoogleEvent, createGoogleEvent, type CalendarSettings } from '@/lib/google-calendar'

// PATCH /api/bookings/[id] — cancel or update a booking
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params
  const body    = await req.json()
  const db      = createServiceClient()

  // Auth check: get the booking first and verify ownership
  const { data: booking } = await db.from('bookings').select('*, calendar_settings(*)').eq('id', id).single()
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Verify caller owns this calendar (check auth header/cookie)
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { data: { user } } = await db.auth.getUser(token)
  if (!user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Verify user owns the calendar this booking belongs to
  const { data: calSettings } = await db
    .from('calendar_settings')
    .select('slug')
    .eq('user_email', user.email)
    .single()

  if (!calSettings || calSettings.slug !== booking.calendar_slug) {
    return NextResponse.json({ error: 'Not authorized to modify this booking' }, { status: 403 })
  }

  if (body.status === 'cancelled') {
    // Delete Google Calendar event if present
    if (booking?.google_event_id && booking.calendar_settings) {
      const accessToken = await getValidAccessToken(booking.calendar_settings as unknown as CalendarSettings)
      if (accessToken) {
        await deleteGoogleEvent(accessToken, booking.google_event_id).catch(e => console.warn('Failed to delete Google event:', e))
      }
    }

    // Send cancellation email
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey && booking?.client_email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'GravHub Scheduling <noreply@app.gravissmarketing.com>',
            to: booking.client_email,
            subject: `Cancelled: ${booking.calendar_settings?.title || 'Meeting'}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <div style="background:#012b1e;padding:24px;border-radius:8px;margin-bottom:24px">
                <div style="font-size:14px;font-weight:700;color:#fff;letter-spacing:0.2em">GRAVISS MARKETING</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">BOOKING CANCELLED</div>
              </div>
              <h2 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 8px">Your booking has been cancelled</h2>
              <p style="color:#6b7280;font-size:14px">The meeting originally scheduled has been cancelled. If you'd like to reschedule, please use your booking link.</p>
            </div>`,
          }),
        })
      }
    } catch {}
  }

  if (body.status === 'rescheduled' && body.newDate && body.newStartTime && body.newEndTime) {
    const { data: reschBooking } = await db.from('bookings').select('*, calendar_settings(*)').eq('id', id).single()
    if (!reschBooking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    // Delete old Google event
    if (reschBooking.google_event_id && reschBooking.calendar_settings) {
      const accessToken = await getValidAccessToken(reschBooking.calendar_settings as unknown as CalendarSettings)
      if (accessToken) {
        await deleteGoogleEvent(accessToken, reschBooking.google_event_id).catch(() => {})
      }
    }

    // Create new Google event
    let newEventId: string | null = null
    let newMeetLink: string | null = null
    if (reschBooking.calendar_settings) {
      const accessToken = await getValidAccessToken(reschBooking.calendar_settings as unknown as CalendarSettings)
      if (accessToken) {
        try {
          const result = await createGoogleEvent(accessToken, {
            summary: `${reschBooking.calendar_settings.title} — ${reschBooking.client_name}`,
            description: reschBooking.notes || 'Booked via GravHub Scheduling (Rescheduled)',
            dateTimeStart: `${body.newDate}T${body.newStartTime}:00`,
            dateTimeEnd: `${body.newDate}T${body.newEndTime}:00`,
            timezone: reschBooking.timezone,
            attendeeEmail: reschBooking.client_email,
            attendeeName: reschBooking.client_name,
          })
          newEventId = result.eventId
          newMeetLink = result.meetLink
        } catch {}
      }
    }

    // Update booking
    const { data: updated, error: updateErr } = await db
      .from('bookings')
      .update({
        date: body.newDate,
        start_time: body.newStartTime,
        end_time: body.newEndTime,
        google_event_id: newEventId,
        meet_link: newMeetLink,
        status: 'confirmed', // Back to confirmed after reschedule
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: 'Failed to reschedule' }, { status: 500 })

    // Send reschedule email (best-effort)
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey && reschBooking.client_email) {
        const dateLabel = new Date(`${body.newDate}T12:00:00`).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
        const [sh, sm] = body.newStartTime.split(':').map(Number)
        const period = sh < 12 ? 'AM' : 'PM'
        const hour = sh % 12 === 0 ? 12 : sh % 12
        const timeLabel = `${hour}:${String(sm).padStart(2, '0')} ${period}`

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'GravHub Scheduling <noreply@app.gravissmarketing.com>',
            to: reschBooking.client_email,
            subject: `Rescheduled: ${reschBooking.calendar_settings?.title || 'Meeting'} with ${reschBooking.calendar_settings?.user_name || 'Graviss Marketing'}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <div style="background:#012b1e;padding:24px;border-radius:8px;margin-bottom:24px">
                <div style="font-size:14px;font-weight:700;color:#fff;letter-spacing:0.2em">GRAVISS MARKETING</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">BOOKING RESCHEDULED</div>
              </div>
              <h2 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 8px">Your meeting has been rescheduled</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
                <div style="margin-bottom:10px"><strong style="font-size:12px;color:#9ca3af;text-transform:uppercase">New Date</strong><br><span style="font-size:14px;color:#1f2937">${dateLabel}</span></div>
                <div><strong style="font-size:12px;color:#9ca3af;text-transform:uppercase">New Time</strong><br><span style="font-size:14px;color:#1f2937">${timeLabel}</span></div>
              </div>
              ${newMeetLink ? `<a href="${newMeetLink}" style="display:block;background:#015035;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;text-align:center;margin-bottom:24px">Join Google Meet</a>` : ''}
              <p style="font-size:13px;color:#9ca3af">If you need to make further changes, please reply to this email.</p>
            </div>`,
          }),
        })
      }
    } catch {}

    return NextResponse.json(updated)
  }

  const { data, error } = await db
    .from('bookings')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[bookings PATCH]', error)
    return NextResponse.json({ error: error?.message || 'Failed to update booking' }, { status: 500 })
  }
  return NextResponse.json(data)
}
