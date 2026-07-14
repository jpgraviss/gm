import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'

function isOwnerOrAdmin(user: { email: string; isAdmin: boolean; role: string }, targetEmail: string): boolean {
  return user.isAdmin || user.role === 'Leadership' || user.email.toLowerCase() === targetEmail.toLowerCase()
}

// GET /api/calendar/settings?email=...
export const GET = withErrorHandler('calendar/settings GET', async (req) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('calendar_settings')
    .select('*')
    .eq('user_email', email)
    .single()

  if (error?.code === 'PGRST116') return NextResponse.json(null) // not found
  if (error) {
    throw new Error(error?.message || 'Failed to fetch calendar settings')
  }
  return NextResponse.json(data)
})

// POST /api/calendar/settings — create or update calendar settings
export const POST = withErrorHandler('calendar/settings POST', async (req) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await req.json()
  const {
    userEmail, userName, slug, title, description,
    duration, buffer, timezone,
    availableDays, availableStart, availableEnd,
  } = body

  if (!userEmail || !slug) {
    return NextResponse.json({ error: 'userEmail and slug required' }, { status: 400 })
  }
  if (!isOwnerOrAdmin(user, userEmail)) {
    return NextResponse.json({ error: 'Cannot modify another team member\'s booking calendar' }, { status: 403 })
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

  if (error) {
    throw new Error(error?.message || 'Failed to save calendar settings')
  }
  return NextResponse.json(data)
})

// DELETE /api/calendar/settings — delete a booking link / calendar settings
// Bookings cascade-delete via FK on calendar_settings(slug)
export const DELETE = withErrorHandler('calendar/settings DELETE', async (req) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!isOwnerOrAdmin(user, email)) {
    return NextResponse.json({ error: 'Cannot delete another team member\'s booking calendar' }, { status: 403 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('calendar_settings')
    .delete()
    .eq('user_email', email)

  if (error) {
    throw new Error(error?.message || 'Failed to delete calendar settings')
  }
  return NextResponse.json({ deleted: true })
})
