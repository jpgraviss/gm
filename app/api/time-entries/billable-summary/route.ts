import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { applyCursor, slicePage, MAX_LIMIT } from '@/lib/pagination'

type ServiceClient = ReturnType<typeof createServiceClient>

// AUDIT #419 — this route previously ran a single unbounded `.select('*')`
// query with no pagination at all, unlike its sibling GET /api/time-entries,
// which correctly uses parsePagination/applyCursor. That left it entirely
// dependent on PostgREST's default row cap: once unbilled entries exceeded
// it, older ones silently vanished from the "Unbilled Time" panel and could
// never be selected for invoicing, with no error or indication anything was
// missing. This response is a computed aggregate (grouped-by-project
// summary), not a raw row list, so exposing limit/cursor query params to the
// caller the way GET /api/time-entries does isn't workable here — a
// caller would have to re-merge partial groups across pages themselves.
// Instead, this loops internally using the exact same applyCursor/slicePage
// helpers as every other paginated route in this codebase until every
// matching row has been fetched, then groups the complete set. Ordered by
// 'date' (matching this route's pre-existing sort) rather than
// 'created_at' — applyCursor/slicePage are generic over the orderBy field.
async function fetchAllBillableRows(db: ServiceClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = []
  let cursor: string | null = null
  for (;;) {
    let query = db
      .from('time_entries')
      .select('*')
      .eq('billable', true)
      .or('invoiced.is.null,invoiced.eq.false')
    query = applyCursor(query, { limit: MAX_LIMIT, cursor, orderBy: 'date' })
    const { data, error } = await query
    if (error) {
      throw new Error(error?.message || 'Failed to fetch billable summary')
    }
    const { rows: page, nextCursor } = slicePage(data ?? [], MAX_LIMIT, 'date')
    rows.push(...page)
    if (!nextCursor) break
    cursor = nextCursor
  }
  return rows
}

export const GET = withErrorHandler('time-entries/billable-summary GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()

  const data = await fetchAllBillableRows(db)

  // AUDIT #435 — this query previously never looked at approval_status at
  // all, so a Dept Manager's explicit Rejected on a time entry had zero
  // effect on whether it showed up here as "Unbilled Time" and got billed
  // to a client via the Create Invoice flow. Filtered here in JS (not via
  // a second chained `.or()` on the query above) because PostgREST's
  // handling of two independently-chained `.or()` calls on the same
  // request isn't a pattern used anywhere else in this codebase and its
  // AND-vs-override semantics across repeated query params aren't worth
  // gambling on for a billing-correctness fix; a plain `.neq()` would also
  // be wrong here since Postgres' NULL-propagating `<>` silently drops
  // every row whose approval_status is NULL (`e.approval_status !==
  // 'rejected'` in JS does not have that problem).
  //
  // Deliberately NOT requiring approval_status === 'approved': this table
  // defaults every new entry to 'pending' (see
  // supabase/migrations/add_timesheet_approvals.sql), and nothing else in
  // this codebase currently gates invoicing on manager approval having
  // happened first — doing so here would silently block all
  // not-yet-reviewed time from ever being invoiced, a much bigger
  // workflow change than this fix is scoped for. Flagged in AUDIT.md for a
  // product-owner call if "no invoicing before approval" is actually the
  // intended policy.
  const billableRows = (data ?? []).filter(e => e.approval_status !== 'rejected')

  // Group by project/company
  const groups: Record<string, {
    projectName: string
    projectId: string | null
    entries: typeof billableRows
    totalHours: number
    totalMinutes: number
  }> = {}

  for (const entry of billableRows) {
    const key = entry.project_name || 'Unassigned'
    if (!groups[key]) {
      groups[key] = {
        projectName: key,
        projectId: entry.project_id,
        entries: [],
        totalHours: 0,
        totalMinutes: 0,
      }
    }
    groups[key].entries.push(entry)
    groups[key].totalMinutes += (entry.hours ?? 0) * 60 + (entry.minutes ?? 0)
  }

  // Convert total minutes to hours + minutes
  const summary = Object.values(groups).map(g => ({
    projectName: g.projectName,
    projectId: g.projectId,
    totalHours: Math.floor(g.totalMinutes / 60),
    totalMinutes: g.totalMinutes % 60,
    entryCount: g.entries.length,
    entries: g.entries.map(e => ({
      id: e.id,
      date: e.date,
      description: e.description,
      teamMember: e.team_member,
      hours: e.hours,
      minutes: e.minutes,
      serviceType: e.service_type,
      // AUDIT #435 — previously omitted entirely, so the UI had no way to
      // tell an approved entry from a still-pending one in this list even
      // though the rejected ones are now excluded server-side above.
      approvalStatus: e.approval_status ?? 'pending',
    })),
  }))

  return NextResponse.json(summary)
})
