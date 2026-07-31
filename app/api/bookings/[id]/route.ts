import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, deleteGoogleEvent, createGoogleEvent, getGoogleBusySlots, computeAvailableSlots, type CalendarSettings } from '@/lib/google-calendar'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole, getAuthUser } from '@/lib/rbac'

// AUDIT #601 — previously authenticated by reading a raw `Authorization:
// Bearer` header and calling `db.auth.getUser(token)` directly, instead of
// the app's real session transport (the signed httpOnly `gravhub-auth`
// cookie every other route uses via getAuthUser/requireRole). The only real
// callers (app/calendar/page.tsx's Cancel/Delete handlers) fetch same-origin
// with no Authorization header at all, and Google Sign-In staff never hold a
// Supabase JWT to send even if they tried — every Cancel/Delete/Reschedule
// on a legacy booking 401'd unconditionally. Same bug shape already fixed
// once at #152 (push/subscribe), missed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyCalendarOwnership(req: NextRequest, db: any, calendarSlug: string): Promise<NextResponse | null> {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const user = await getAuthUser(req)
  if (!user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data: calSettings } = await db
    .from('calendar_settings')
    .select('slug')
    .eq('user_email', user.email)
    .single()

  if (!calSettings || calSettings.slug !== calendarSlug) {
    return NextResponse.json({ error: 'Not authorized to modify this booking' }, { status: 403 })
  }
  return null
}

// PATCH /api/bookings/[id] — cancel or update a booking
export const PATCH = withErrorHandler('bookings/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id }  = await params
  const body    = await req.json()
  const db      = createServiceClient()

  // Auth check: get the booking first and verify ownership
  const { data: booking } = await db.from('bookings').select('*, calendar_settings(*)').eq('id', id).single()
  if (!booking) {
    // AUDIT #230 — a booking can live in either of two tables depending on
    // which flow created it (same split DELETE on this route already
    // handles, per #123): legacy `bookings` rows belong to one staff
    // member's personal calendar, `booking_type_bookings` rows belong to an
    // org-wide, not-per-staff booking type. This route previously only ever
    // looked in `bookings`, so cancelling a new-flow appointment from the
    // week/day view always 404'd.
    const { data: typeBooking } = await db.from('booking_type_bookings').select('*').eq('id', id).maybeSingle()
    if (!typeBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied

    const { data, error } = await db
      .from('booking_type_bookings')
      .update({ status: body.status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error?.message || 'Failed to update booking')
    }
    return NextResponse.json(data)
  }

  const ownershipDenied = await verifyCalendarOwnership(req, db, booking.calendar_slug)
  if (ownershipDenied) return ownershipDenied

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

    // AUDIT #571 — this branch previously deleted the old Google event and
    // wrote the new date/time straight to the DB with none of the
    // conflict-detection POST /api/bookings has: no re-check against
    // available_days/business hours, no re-check against other confirmed
    // bookings, no live Google Calendar busy-slot check, no past-date
    // rejection. A caller could move a booking onto an already-double-booked
    // slot, outside business hours, or into the past. Reuses the exact same
    // computeAvailableSlots helper the slot picker and POST /api/bookings
    // already use, so this can't drift from what's actually bookable — and
    // runs entirely before any Google Calendar event is touched, so a
    // rejected reschedule never deletes the original event.
    if (!reschBooking.calendar_settings) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
    }
    const calendarSettings = reschBooking.calendar_settings as unknown as CalendarSettings

    const reschAccessToken = await getValidAccessToken(calendarSettings)
    let reschGoogleBusySlots: { start: string; end: string }[] = []
    if (reschAccessToken) {
      try {
        reschGoogleBusySlots = await getGoogleBusySlots(reschAccessToken, body.newDate, calendarSettings.timezone)
      } catch (e) {
        console.error('[bookings/[id] PATCH] Google Calendar busy check failed:', e)
      }
    }

    const { data: existingBookingsForNewDate } = await db
      .from('bookings')
      .select('start_time, end_time')
      .eq('calendar_slug', reschBooking.calendar_slug)
      .eq('date', body.newDate)
      .eq('status', 'confirmed')
      .neq('id', id)

    const reschAvailableSlots = computeAvailableSlots(
      body.newDate,
      calendarSettings,
      reschGoogleBusySlots,
      existingBookingsForNewDate ?? [],
    )
    const reschSlotIsAvailable = reschAvailableSlots.some(
      s => s.start === body.newStartTime && s.end === body.newEndTime,
    )
    if (!reschSlotIsAvailable) {
      return NextResponse.json(
        { error: 'This time is outside available hours or no longer available. Please choose another.' },
        { status: 409 },
      )
    }

    // Race-recheck immediately before writing (same reasoning/boundaries as
    // POST /api/bookings' equivalent check).
    const { data: reschConflict } = await db
      .from('bookings')
      .select('id')
      .eq('calendar_slug', reschBooking.calendar_slug)
      .eq('date', body.newDate)
      .eq('status', 'confirmed')
      .neq('id', id)
      .lt('start_time', body.newEndTime)
      .gt('end_time', body.newStartTime)
      .limit(1)

    if (reschConflict && reschConflict.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is no longer available. Please choose another.' },
        { status: 409 },
      )
    }

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

    if (updateErr) {
      // 23505 = unique_violation from bookings_slot_unique — a final,
      // narrow race window between the checks above and this write (same
      // reasoning as POST /api/bookings' equivalent handling).
      if ((updateErr as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'This time slot was just booked by someone else. Please choose another.' },
          { status: 409 },
        )
      }
      throw new Error('Failed to reschedule')
    }

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
    throw new Error(error?.message || 'Failed to update booking')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('bookings/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  // Previously had zero auth at all — anyone who obtained/guessed a
  // booking id could permanently delete any booking. A booking can live in
  // either of two tables depending on which flow created it: legacy
  // `bookings` rows belong to one staff member's personal calendar (same
  // ownership model as PATCH above); `booking_type_bookings` rows belong to
  // an org-wide, not-per-staff booking type, so any authenticated staff
  // member managing the shared calendar is authorized — just require real
  // staff auth for those, not a specific-owner match.
  const { data: legacyBooking } = await db.from('bookings').select('calendar_slug').eq('id', id).maybeSingle()
  if (legacyBooking) {
    const ownershipDenied = await verifyCalendarOwnership(req, db, legacyBooking.calendar_slug)
    if (ownershipDenied) return ownershipDenied
  } else {
    const { data: newBooking } = await db.from('booking_type_bookings').select('id').eq('id', id).maybeSingle()
    if (!newBooking) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied
  }

  const { error: e1 } = await db.from('bookings').delete().eq('id', id)
  const { error: e2 } = await db.from('booking_type_bookings').delete().eq('id', id)

  if (e1 && e2) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
})
