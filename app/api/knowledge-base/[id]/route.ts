import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { blockIfPreview } from '@/lib/portal-auth'

const KB_STATUSES = new Set(['draft', 'published'])

export const GET = withErrorHandler('knowledge-base/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db.from('knowledge_articles').select('*').eq('id', id).single()
  if (error || !data) {
    // AUDIT #753 — this returned `error.message` verbatim, which for the
    // ordinary not-found case is PostgREST's "JSON object requested,
    // multiple (or no) rows returned" — internal wording shown straight to
    // the caller. Every sibling `[id]` route in this app returns a plain
    // "<Thing> not found"; this is the one that didn't. The real error is
    // still logged. `!data` is also now checked, matching the siblings.
    console.error('[knowledge-base/:id GET]', error)
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // AUDIT #276 — atomic RPC instead of a read-then-write increment.
  await db.rpc('increment_kb_article_views', { p_id: id })

  return NextResponse.json(data)
})

export const PATCH = withErrorHandler('knowledge-base/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  // AUDIT #763 — defence in depth beside previewFetch() on the client.
  const previewBlocked = blockIfPreview(req)
  if (previewBlocked) return previewBlocked
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  // Handle feedback increment separately (doesn't update updated_at) — this
  // is the one legitimate portal-client call site (the "was this helpful?"
  // widget), so it stays open to any authenticated caller. Everything else
  // below (real content edits) requires staff.
  //
  // AUDIT #536 — this comment previously described intent this branch
  // didn't enforce: nothing preceded it, so it was reachable by a fully
  // anonymous, unauthenticated request, not just "any authenticated
  // caller." Only impact was spammable vote counts (no data leak), but the
  // comment misrepresented the actual behavior.
  if (body.feedback === 'helpful' || body.feedback === 'not_helpful') {
    const feedbackEmail = await getAuthenticatedEmail(req)
    if (!feedbackEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const col = body.feedback === 'helpful' ? 'helpful_count' : 'not_helpful_count'
    // AUDIT — atomic RPC instead of a read-then-write increment, which
    // could lose a count under concurrent feedback submissions, unlike the
    // sibling `views` counter above (already fixed via increment_kb_article_views).
    const { error: fbErr } = await db.rpc('increment_kb_article_feedback', { p_id: id, p_column: col })
    if (fbErr) {
      throw new Error(fbErr?.message || 'Failed to update feedback')
    }
    return NextResponse.json({ ok: true })
  }

  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  // AUDIT #595 — accepted body.status verbatim with no enum check.
  if (body.status !== undefined && !KB_STATUSES.has(body.status)) {
    return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) update.title = body.title
  if (body.body !== undefined) update.body = body.body
  if (body.category !== undefined) update.category = body.category
  if (body.tags !== undefined) update.tags = body.tags
  if (body.status !== undefined) update.status = body.status
  if (body.author !== undefined) update.author = body.author

  const { data, error } = await db.from('knowledge_articles').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update knowledge article')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('knowledge-base/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('knowledge_articles').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete knowledge article')
  }
  return NextResponse.json({ deleted: id })
})
