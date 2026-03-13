import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  getValidAccessToken,
  createGoogleEvent,
  type CalendarSettings,
} from '@/lib/google-calendar'

// GET /api/bookings?slug=jaycee-graviss&status=confirmed
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug   = searchParams.get('slug')
  const status = searchParams.get('status')

  const db = createServiceClient()
  let query = db
    .from('bookings')
    .select('*')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (slug)   query = query.eq('calendar_slug', slug)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[bookings GET]', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/bookings — create a new booking
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    calendarSlug,
    clientName, clientEmail, clientCompany, clientPhone, notes,
    date, startTime, endTime,
  } = body

  if (!calendarSlug || !clientName || !clientEmail || !date || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch calendar settings
  const { data: settings, error: settingsErr } = await db
    .from('calendar_settings')
    .select('*')
    .eq('slug', calendarSlug)
    .single()

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  // Double-check slot is still available (prevent race conditions)
  const { data: conflict } = await db
    .from('bookings')
    .select('id')
    .eq('calendar_slug', calendarSlug)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lte('start_time', endTime)
    .gte('end_time', startTime)
    .limit(1)

  if (conflict && conflict.length > 0) {
    return NextResponse.json(
      { error: 'This time slot is no longer available. Please choose another.' },
      { status: 409 },
    )
  }

  // Create Google Calendar event if connected
  let googleEventId: string | null = null
  let meetLink: string | null = null

  const accessToken = await getValidAccessToken(settings as CalendarSettings)
  if (accessToken) {
    try {
      const result = await createGoogleEvent(accessToken, {
        summary:       `${settings.title} — ${clientName}${clientCompany ? ` (${clientCompany})` : ''}`,
        description:   notes
          ? `Booked via GravHub Scheduling\n\nClient notes: ${notes}`
          : 'Booked via GravHub Scheduling',
        dateTimeStart: `${date}T${startTime}:00`,
        dateTimeEnd:   `${date}T${endTime}:00`,
        timezone:      settings.timezone,
        attendeeEmail: clientEmail,
        attendeeName:  clientName,
      })
      googleEventId = result.eventId
      meetLink      = result.meetLink
    } catch {
      // Non-fatal: booking still created without Google Calendar
    }
  }

  // Insert booking
  const { data: booking, error: insertErr } = await db
    .from('bookings')
    .insert({
      calendar_slug:  calendarSlug,
      client_name:    clientName,
      client_email:   clientEmail,
      client_company: clientCompany ?? null,
      client_phone:   clientPhone   ?? null,
      notes:          notes         ?? null,
      date,
      start_time:     startTime,
      end_time:       endTime,
      timezone:       settings.timezone,
      status:         'confirmed',
      google_event_id: googleEventId,
      meet_link:       meetLink,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[bookings POST]', insertErr)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Send confirmation email via Resend (best-effort)
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
      const [sh, sm] = startTime.split(':').map(Number)
      const period   = sh < 12 ? 'AM' : 'PM'
      const hour     = sh % 12 === 0 ? 12 : sh % 12
      const timeLabel = `${hour}:${String(sm).padStart(2, '0')} ${period} ${settings.timezone}`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'GravHub Scheduling <noreply@app.gravissmarketing.com>',
          to:      clientEmail,
          subject: `Confirmed: ${settings.title} with ${settings.user_name}`,
          html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <div style="background:#012b1e;padding:24px;border-radius:8px;margin-bottom:24px">
    <div style="font-size:14px;font-weight:700;color:#fff;letter-spacing:0.2em">GRAVISS MARKETING</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">BOOKING CONFIRMED</div>
  </div>
  <h2 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 8px">${settings.title}</h2>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px">with ${settings.user_name}</p>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
    <div style="margin-bottom:10px"><strong style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Date</strong><br><span style="font-size:14px;color:#1f2937">${dateLabel}</span></div>
    <div style="margin-bottom:10px"><strong style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Time</strong><br><span style="font-size:14px;color:#1f2937">${timeLabel}</span></div>
    <div><strong style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em">Duration</strong><br><span style="font-size:14px;color:#1f2937">${settings.duration} minutes</span></div>
  </div>
  ${meetLink ? `<a href="${meetLink}" style="display:block;background:#015035;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;text-align:center;margin-bottom:24px">Join Google Meet</a>` : ''}
  <p style="font-size:13px;color:#9ca3af">A calendar invite has been sent to your email. If you need to reschedule, please reply to this email.</p>
</div>`,
        }),
      })
    }
  } catch { /* non-fatal */ }

  return NextResponse.json(booking, { status: 201 })
}
