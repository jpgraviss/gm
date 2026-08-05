import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * GET /api/calendar/calendars — the staff calendars a booking type can be
 * assigned to (AUDIT #699).
 *
 * Deliberately selects ONLY slug/title/active. `calendar_settings` also
 * holds Google OAuth refresh/access tokens, and AUDIT #450/#451 were
 * exactly this table leaking those through a GET route — never widen this
 * to `select('*')`.
 */
export const GET = withErrorHandler('calendar/calendars GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('calendar_settings')
    .select('slug, title, active')
    .order('title', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(
    (data ?? []).map(c => ({ slug: c.slug, title: c.title, active: c.active })),
  )
})
