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

  const { data: existing } = await db
    .from('training_progress')
    .select('completed, checklist_state')
    .eq('user_email', userEmail)
    .eq('content_id', contentId)
    .maybeSingle()

  const update: Record<string, unknown> = {
    id: `tp-${userEmail}-${contentId}`.replace(/[^a-z0-9-]/gi, '_'),
    user_email: userEmail,
    content_id: contentId,
    completed: existing?.completed ?? false,
    checklist_state: existing?.checklist_state ?? {},
    updated_at: new Date().toISOString(),
  }

  if (typeof body.completed === 'boolean') {
    update.completed = body.completed
  }
  if (typeof body.checklistItemId === 'string') {
    const checklist = { ...(existing?.checklist_state ?? {}) } as Record<string, boolean>
    checklist[body.checklistItemId] = !!body.checklistValue
    update.checklist_state = checklist
  }

  const { error } = await db.from('training_progress').upsert(update, { onConflict: 'user_email,content_id' })
  if (error) {
    throw new Error(error.message || 'Failed to save training progress')
  }

  return NextResponse.json({ ok: true })
})
