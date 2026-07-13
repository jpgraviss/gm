import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthUser } from '@/lib/rbac'

// GET /api/training/progress — the caller's own training completion/
// checklist state, server-persisted (previously localStorage-only, lost on
// storage clear or device switch). Leadership/Super Admin/admins can pass
// ?userEmail= to check someone else's progress (team-wide visibility).
export const GET = withErrorHandler('training/progress GET', async (req) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const requestedEmail = searchParams.get('userEmail')
  const unrestricted = user.isAdmin || user.role === 'Leadership' || user.role === 'Super Admin'
  const targetEmail = requestedEmail && unrestricted ? requestedEmail.toLowerCase() : user.email.toLowerCase()

  const db = createServiceClient()
  const { data, error } = await db
    .from('training_progress')
    .select('content_id, completed, checklist_state')
    .eq('user_email', targetEmail)

  if (error) {
    throw new Error(error.message || 'Failed to fetch training progress')
  }

  const completion: Record<string, boolean> = {}
  const checklistState: Record<string, Record<string, boolean>> = {}
  for (const row of data ?? []) {
    if (row.completed) completion[row.content_id] = true
    if (row.checklist_state && Object.keys(row.checklist_state).length > 0) {
      checklistState[row.content_id] = row.checklist_state
    }
  }

  return NextResponse.json({ completion, checklistState })
})

// PATCH /api/training/progress — upsert one content item's progress for the
// caller. Body: { contentId, completed?: boolean, checklistItemId?: string,
// checklistValue?: boolean }
export const PATCH = withErrorHandler('training/progress PATCH', async (req) => {
  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await req.json()
  const contentId = body.contentId as string | undefined
  if (!contentId || typeof contentId !== 'string') {
    return NextResponse.json({ error: 'contentId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const userEmail = user.email.toLowerCase()

  const setCompleted = typeof body.completed === 'boolean'
  const setChecklist = typeof body.checklistItemId === 'string'

  // Atomic — the merge into checklist_state happens inside the DB's
  // UPSERT (see supabase/migrations/add_race_condition_fixes.sql), so two
  // rapid toggles on different checklist items for the same content_id
  // can't clobber each other the way a read-then-full-overwrite would
  // (AUDIT.md #45).
  const { error } = await db.rpc('upsert_training_progress', {
    p_id: `tp-${userEmail}-${contentId}`.replace(/[^a-z0-9-]/gi, '_'),
    p_user_email: userEmail,
    p_content_id: contentId,
    p_set_completed: setCompleted,
    p_completed: setCompleted ? body.completed : false,
    p_set_checklist: setChecklist,
    p_checklist_item_id: setChecklist ? body.checklistItemId : '',
    p_checklist_value: setChecklist ? !!body.checklistValue : false,
  })
  if (error) {
    throw new Error(error.message || 'Failed to save training progress')
  }

  return NextResponse.json({ ok: true })
})
