import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'

// GET /api/sequences/rep-activity — a rep's own outreach activity for a day.
// sequence_activities has no direct rep column; it joins through
// enrollment_id -> sequence_enrollments.assigned_rep_id, so this is two
// queries rather than a single-table filter.
export const GET = withErrorHandler('sequences/rep-activity GET', async (req: NextRequest) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const requestedRepId = searchParams.get('repId')
  // Only Leadership/Super Admin/admins can view someone else's activity —
  // everyone else only ever sees their own, same visibility posture as the
  // department-scoped tasks system.
  const unrestricted = user.isAdmin || user.role === 'Leadership' || user.role === 'Super Admin'
  const repId = requestedRepId && unrestricted ? requestedRepId : user.userId

  const db = createServiceClient()

  const { data: enrollments } = await db
    .from('sequence_enrollments')
    .select('id, status')
    .eq('assigned_rep_id', repId)

  const enrollmentIds = (enrollments ?? []).map(e => e.id)
  const activeEnrollments = (enrollments ?? []).filter(e => e.status === 'active').length

  const counts = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }
  if (enrollmentIds.length > 0) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const { data: activities } = await db
      .from('sequence_activities')
      .select('event_type')
      .in('enrollment_id', enrollmentIds)
      .gte('created_at', startOfToday.toISOString())

    for (const a of activities ?? []) {
      if (a.event_type in counts) counts[a.event_type as keyof typeof counts]++
    }
  }

  return NextResponse.json({
    repId,
    date: new Date().toISOString().split('T')[0],
    activeEnrollments,
    ...counts,
    totalActivities: Object.values(counts).reduce((s, n) => s + n, 0),
  })
})
