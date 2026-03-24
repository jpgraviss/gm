import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getValidAccessToken, deleteGoogleEvent, type CalendarSettings } from '@/lib/google-calendar'

// PATCH /api/bookings/[id] — cancel or update a booking
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params
  const body    = await req.json()
  const db      = createServiceClient()

  if (body.status === 'cancelled') {
    // Fetch booking + settings to delete Google event
    const { data: booking } = await db.from('bookings').select('*, calendar_settings(*)').eq('id', id).single()
    if (booking?.google_event_id && booking.calendar_settings) {
      const accessToken = await getValidAccessToken(booking.calendar_settings as unknown as CalendarSettings)
      if (accessToken) {
        await deleteGoogleEvent(accessToken, booking.google_event_id).catch(e => console.warn('Failed to delete Google event:', e))
      }
    }
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
