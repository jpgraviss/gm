import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser, hasRoleAtLeast } from '@/lib/rbac'
import { applyCursor, slicePage, MAX_LIMIT } from '@/lib/pagination'

/**
 * GET /api/calendar/team?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * The combined, deliberately-shared multi-staff schedule behind the Calendar
 * page's "Team" view. Every other calendar surface in this app is
 * single-person: /api/bookings is filtered by the caller's own
 * calendar_slug, and the personal iCal feed is scoped to one
 * calendar_settings row. With several staff booking client meetings there was
 * no way to see the combined schedule at all, which is a real
 * double-booking risk.
 *
 * ── Visibility decision (read this before widening or narrowing it) ───────
 *
 * AUDIT #231 fixed a genuine leak: the *personal* iCal feed silently
 * returned every colleague's bookings (guest name/email/phone/notes) to
 * whoever subscribed, because new-flow bookings had no owner column to scope
 * by. That fix must not be undone, and this route does not undo it — the
 * feed stays personal-only. This is the opposite shape: an explicitly
 * labeled, opt-in Team view that a staff member has to switch to.
 *
 * Two separate questions, answered differently:
 *
 *  1. WHO CAN SEE THE TEAM'S SCHEDULE — every Team Member.
 *     Scheduling collisions are not a management problem, they are the
 *     problem of whoever is about to book the meeting, and in this agency
 *     that is every staff member with a booking link. Gating the whole view
 *     to Dept Manager+ would leave the exact people who cause and suffer
 *     collisions unable to see them, which is the gap this feature exists to
 *     close. "Person X is busy 2–3pm Tuesday" is also not sensitive
 *     internally — it is already visible on every shared work calendar.
 *
 *  2. WHO CAN SEE THE GUEST'S DETAILS — only the booking's own owner, and
 *     Dept Manager and above.
 *     Guest email/phone/notes is the part AUDIT #231 was actually about, and
 *     none of it is needed to avoid a collision. So it is stripped
 *     server-side (not hidden in the UI) for other people's bookings unless
 *     the caller is Dept Manager+, who already have cross-unit CRUD in
 *     ROLE_HIERARCHY. Each entry carries details_visible so the client never
 *     has to guess whether a null field means "redacted" or "empty".
 *     The client's *name* is deliberately kept for everyone: which client a
 *     colleague is meeting is already visible org-wide to any Team Member
 *     through the CRM, and it is frequently the thing that prevents the
 *     collision (two people booking the same account on the same day).
 *
 * Owner attribution comes from the two real ownership columns that now
 * exist: bookings.calendar_slug (legacy flow) and
 * booking_types.owner_calendar_slug (AUDIT #699). Unattributable rows are
 * NOT dropped or silently reassigned — they are returned with
 * owner_slug: null so the UI can surface them as "Unassigned", which is also
 * how a booking type that nobody assigned a calendar owner to becomes
 * visible instead of quietly missing.
 */

type ServiceClient = ReturnType<typeof createServiceClient>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// A team view is only ever asked for a day or a week; the cap keeps a
// hand-crafted query from scanning the whole booking history.
const MAX_RANGE_DAYS = 62

export interface TeamScheduleEntry {
  id: string
  source: 'booking' | 'booking_type_booking'
  owner_slug: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  timezone: string
  title: string
  type_name: string | null
  color: string | null
  meet_link: string | null
  guest_email: string | null
  guest_company: string | null
  notes: string | null
  details_visible: boolean
}

/**
 * AUDIT #206/#317/#534/#419 — a single .select() here would silently stop at
 * PostgREST's default row cap and show a partially-empty team schedule,
 * which for a collision-avoidance view is worse than showing nothing. This
 * response is a merged, derived feed across two tables, so it can't hand the
 * caller a cursor of its own (page boundaries wouldn't line up between the
 * two sources); instead it loops internally with the same
 * applyCursor/slicePage helpers every paginated route uses, exactly like
 * time-entries/billable-summary does, until the range is complete.
 */
async function fetchAllInRange(
  db: ServiceClient,
  table: 'bookings' | 'booking_type_bookings',
  select: string,
  start: string,
  end: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []
  let cursor: string | null = null
  for (;;) {
    let query = db
      .from(table)
      .select(select)
      .gte('date', start)
      .lte('date', end)
      .neq('status', 'cancelled')
    query = applyCursor(query, { limit: MAX_LIMIT, cursor, orderBy: 'date' })
    const { data, error } = await query
    if (error) {
      throw new Error(error.message || `Failed to fetch ${table}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows: page, nextCursor } = slicePage((data ?? []) as any[], MAX_LIMIT, 'date')
    rows.push(...page)
    if (!nextCursor) break
    cursor = nextCursor
  }
  return rows
}

export const GET = withErrorHandler('calendar/team GET', async (req) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasRoleAtLeast(user, 'Team Member')) {
    return NextResponse.json({ error: 'Forbidden: requires Team Member or higher' }, { status: 403 })
  }
  const canSeeAllGuestDetails = hasRoleAtLeast(user, 'Dept Manager')

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') || start
  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return NextResponse.json({ error: 'start (and optional end) must be YYYY-MM-DD' }, { status: 400 })
  }
  if (end < start) {
    return NextResponse.json({ error: 'end must not be before start' }, { status: 400 })
  }
  const rangeDays = Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000,
  ) + 1
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 })
  }

  const db = createServiceClient()

  // Which calendar (if any) belongs to the caller — the one set of bookings
  // whose guest details they always keep, regardless of role.
  const { data: ownCal } = await db
    .from('calendar_settings')
    .select('slug')
    .eq('user_email', user.email)
    .maybeSingle()
  const ownSlug: string | null = ownCal?.slug ?? null

  // booking_type_bookings rows carry no timezone of their own — same
  // fallback resolution app/api/calendar/bookings/route.ts already uses (any
  // connected staff Google Calendar's timezone, else America/Chicago).
  let fallbackTz = 'America/Chicago'
  const { data: tzCals } = await db
    .from('calendar_settings')
    .select('timezone')
    .not('google_refresh_token', 'is', null)
    .limit(1)
  if (tzCals?.[0]?.timezone) fallbackTz = tzCals[0].timezone

  const [legacyRows, typeRows] = await Promise.all([
    fetchAllInRange(db, 'bookings', '*', start, end),
    fetchAllInRange(
      db,
      'booking_type_bookings',
      '*, booking_types(name, slug, color, owner_calendar_slug)',
      start,
      end,
    ),
  ])

  const entries: TeamScheduleEntry[] = []

  for (const b of legacyRows) {
    // 'imported' is the fixed bucket every ICS/subscription import writes to
    // — it names no person, so it is reported as unattributed rather than
    // being shown as somebody's booking.
    const ownerSlug: string | null =
      b.calendar_slug && b.calendar_slug !== 'imported' ? b.calendar_slug : null
    const visible = canSeeAllGuestDetails || (ownerSlug !== null && ownerSlug === ownSlug)
    entries.push({
      id: b.id,
      source: 'booking',
      owner_slug: ownerSlug,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      timezone: b.timezone ?? fallbackTz,
      title: b.client_name ?? 'Busy',
      type_name: b.subscription_id ? 'Imported event' : null,
      color: null,
      meet_link: b.meet_link ?? null,
      guest_email: visible ? (b.client_email ?? null) : null,
      guest_company: visible ? (b.client_company ?? null) : null,
      notes: visible ? (b.notes ?? null) : null,
      details_visible: visible,
    })
  }

  for (const tb of typeRows) {
    const bt = tb.booking_types as
      | { name: string; slug: string; color: string | null; owner_calendar_slug: string | null }
      | null
    const ownerSlug: string | null = bt?.owner_calendar_slug ?? null
    const visible = canSeeAllGuestDetails || (ownerSlug !== null && ownerSlug === ownSlug)
    entries.push({
      id: tb.id,
      source: 'booking_type_booking',
      owner_slug: ownerSlug,
      date: tb.date,
      start_time: tb.start_time,
      end_time: tb.end_time,
      status: tb.status,
      timezone: fallbackTz,
      title: tb.guest_name ?? 'Busy',
      type_name: bt?.name ?? null,
      color: bt?.color ?? null,
      meet_link: tb.meet_link ?? null,
      guest_email: visible ? (tb.guest_email ?? null) : null,
      guest_company: visible ? (tb.guest_company ?? null) : null,
      notes: visible ? (tb.notes ?? null) : null,
      details_visible: visible,
    })
  }

  entries.sort((a, b) =>
    a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date),
  )

  // A bare array, matching every other calendar list endpoint the Calendar
  // page consumes (its fetches assert Array.isArray).
  return NextResponse.json(entries)
})
