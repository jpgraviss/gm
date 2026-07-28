import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'

export const GET = withErrorHandler('chatbots/[id]/conversations GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const db = createServiceClient()

  // AUDIT #493 — this had no pagination/limit at all, unlike courses/
  // enrollments in the same scope; a chatbot embedded on a public site has
  // a naturally unbounded conversation history, so a busy bot could
  // silently truncate at PostgREST's default row cap with no cursor/
  // next-page affordance. Cursor-paginated on updated_at (matching the
  // page's own default sort) using this codebase's established
  // lib/pagination.ts pattern.
  const pag = { ...parsePagination(req), orderBy: 'updated_at' }

  let query = db
    .from('chatbot_conversations')
    .select('*')
    .eq('chatbot_id', id)

  if (status === 'flagged') {
    query = query.eq('flagged', true)
  } else if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  query = applyCursor(query, pag)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'updated_at')

  // Substring search still runs in application code (message content lives
  // in a JSON column, not something PostgREST can filter on directly) —
  // scoped to this page's rows only. Callers that need every match across
  // the full history (e.g. the conversations page's search box) must
  // follow the cursor via fetchAllPages, same as any other paginated list
  // in this codebase.
  let results = rows
  if (search) {
    const q = search.toLowerCase()
    results = results.filter(c => {
      const msgs = (c.messages as Array<{ content: string }>) || []
      return msgs.some(m => m.content?.toLowerCase().includes(q)) ||
        c.visitor_id?.toLowerCase().includes(q) ||
        c.visitor_name?.toLowerCase().includes(q) ||
        c.visitor_email?.toLowerCase().includes(q)
    })
  }

  return paginatedJson(results, nextCursor)
})

export const PATCH = withErrorHandler('chatbots/[id]/conversations PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const { conversationId, flagged, status: newStatus } = body as {
    conversationId: string
    flagged?: boolean
    status?: string
  }

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof flagged === 'boolean') updates.flagged = flagged
  if (newStatus) updates.status = newStatus

  const { data, error } = await db
    .from('chatbot_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('chatbot_id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('chatbots/[id]/conversations DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('chatbot_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('chatbot_id', id)

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json({ success: true })
})
