import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  getValidAccessToken,
  getGoogleBusySlots,
  computeAvailableSlots,
  type CalendarSettings,
} from '@/lib/google-calendar'

// GET /api/calendar/slots?slug=jaycee-graviss&date=2026-03-10
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const date = searchParams.get('date')

  if (!slug || !date) {
    return NextResponse.json({ error: 'slug and date are required' }, { status: 400 })
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }

  // Don't allow slot queries for dates more than 90 days in the future
  const queryDate = new Date(date)
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 90)
  if (queryDate > maxDate) {
    return NextResponse.json({ error: 'Cannot check slots more than 90 days ahead' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch calendar settings (full row, server-side only)
  const { data: settings, error: settingsError } = await db
    .from('calendar_settings')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (settingsError || !settings) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  // Fetch existing confirmed bookings for that date
  const { data: existingBookings } = await db
    .from('bookings')
    .select('start_time, end_time')
    .eq('calendar_slug', slug)
    .eq('date', date)
    .eq('status', 'confirmed')

  // Fetch Google Calendar busy slots (only if Google is connected)
  let googleBusy: { start: string; end: string }[] = []
  const accessToken = await getValidAccessToken(settings as CalendarSettings)
  if (accessToken) {
    googleBusy = await getGoogleBusySlots(accessToken, date, settings.timezone)
  }

  const slots = computeAvailableSlots(
    date,
    settings as CalendarSettings,
    googleBusy,
    existingBookings ?? [],
  )

  return NextResponse.json({ slots, timezone: settings.timezone })
}
