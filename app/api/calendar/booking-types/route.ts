import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole, getAuthUser } from '@/lib/rbac'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const GET = withErrorHandler('calendar/booking-types GET', async (req) => {
  // AUDIT #253 — this route is intentionally public (the /go/book/[slug]
  // page needs it unauthenticated), but a disabled booking type's full
  // config was still exposed to anyone. The staff-facing calendar/booking
  // management page reuses this same GET and needs to see inactive types
  // too (to re-enable them), so only filter for callers without a real
  // staff session — matches the slot-check/creation endpoints, which
  // already filter on `active` for the public path.
  const db = createServiceClient()
  const user = await getAuthUser(req)
  let query = db.from('booking_types').select('*').order('created_at', { ascending: false })
  if (!user) query = query.eq('active', true)
  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(data)
})

export const POST = withErrorHandler('calendar/booking-types POST', async (req) => {
  // The GET on this route is intentionally public (the /go/book/[slug] page
  // needs it), which means proxy.ts's outer gate can't distinguish this
  // POST from that GET by path prefix alone — this route-level check is
  // now the only thing keeping booking-type creation/editing staff-only.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const body = await req.json()
  const { name, description, duration_minutes, location, color, availability, buffer_minutes, active, id, intake_questions, owner_calendar_slug } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  if (id) {
    // AUDIT — this used to regenerate the slug from the current name on
    // every edit, with no uniqueness check or redirect (unlike the insert
    // path below, which checks for collisions). Renaming a booking type to
    // fix a typo silently 404'd any already-shared/embedded /go/book/{slug}
    // link, and renaming into another type's existing slug threw a raw DB
    // unique-constraint error. The slug is now set once at creation and
    // never changes on a name edit — a public URL a client bookmarked or an
    // agency embedded on their site keeps working regardless of later
    // renames.
    const { data, error } = await db
      .from('booking_types')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        duration_minutes: duration_minutes ?? 30,
        location: location ?? 'zoom',
        color: color ?? '#015035',
        availability: availability ?? { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
        buffer_minutes: buffer_minutes ?? 15,
        active: active ?? true,
        intake_questions: intake_questions ?? [],
        // AUDIT #699 — which staff calendar this booking type's appointments
        // belong on. Null means unassigned, and calendar sync deliberately
        // skips unassigned types rather than picking a random calendar.
        owner_calendar_slug: owner_calendar_slug || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }
    return NextResponse.json(data)
  }

  let slug = slugify(name.trim())
  const { data: existing } = await db
    .from('booking_types')
    .select('slug')
    .eq('slug', slug)

  if (existing && existing.length > 0) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const { data, error } = await db
    .from('booking_types')
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      duration_minutes: duration_minutes ?? 30,
      location: location ?? 'zoom',
      color: color ?? '#015035',
      availability: availability ?? { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
      buffer_minutes: buffer_minutes ?? 15,
      active: active ?? true,
      intake_questions: intake_questions ?? [],
      owner_calendar_slug: owner_calendar_slug || null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(data, { status: 201 })
})
