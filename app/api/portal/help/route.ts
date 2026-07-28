import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

// AUDIT.md #476 — every sibling /api/portal/* route (dashboard/seo/insights)
// is requirePortalClient-gated, but this one had zero auth check, reachable
// by a fully anonymous caller. Unlike those siblings this isn't company-
// scoped (the Help Center catalog isn't per-tenant data), so a full
// requirePortalClient(company) gate doesn't apply here — instead this
// matches the "any authenticated caller" pattern GET /api/courses uses for
// the same kind of portal-visible-but-not-company-scoped content (#385).
export const GET = withErrorHandler('portal/help GET', async (req) => {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const articleId = searchParams.get('id')
  const db = createServiceClient()

  if (articleId) {
    const { data, error } = await db
      .from('knowledge_articles')
      .select('*')
      .eq('id', articleId)
      .eq('status', 'published')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Atomic RPC — a read-then-write here can lose a view increment under
    // concurrent portal-client reads of the same article (already fixed
    // for the staff-side sibling route via this same RPC, see #276).
    await db.rpc('increment_kb_article_views', { p_id: articleId })

    return NextResponse.json(data)
  }

  let query = db
    .from('knowledge_articles')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`)

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to fetch help articles')
  }

  return NextResponse.json(data ?? [])
})
