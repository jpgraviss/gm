import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/calendar/settings?email=...
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('calendar_settings')
    .select('*')
    .eq('user_email', email)
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json(null) // not found
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/calendar/settings — create or update calendar settings
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    userEmail, userName, slug, title, description,
    duration, buffer, timezone,
    availableDays, availableStart, availableEnd,
  } = body

  if (!userEmail || !slug) {
    return NextResponse.json({ error: 'userEmail and slug required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db.from('calendar_settings').upsert({
    user_email:      userEmail,
    user_name:       userName,
    slug,
    title:           title            ?? 'Book a Call',
    description:     description      ?? null,
    duration:        duration         ?? 30,
    buffer:          buffer           ?? 15,
    timezone:        timezone         ?? 'America/Chicago',
    available_days:  availableDays    ?? [1, 2, 3, 4, 5],
    available_start: availableStart   ?? '09:00',
    available_end:   availableEnd     ?? '17:00',
  }, { onConflict: 'user_email' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
