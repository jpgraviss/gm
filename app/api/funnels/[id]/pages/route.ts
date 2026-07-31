import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { slugifyForm } from '@/lib/forms'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('funnels/[id]/pages GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('funnel_pages')
    .select('*')
    .eq('funnel_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(String(error))
  }
  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('funnels/[id]/pages POST', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('funnel_pages')
    .select('sort_order')
    .eq('funnel_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 0

  const pageId = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // AUDIT #430 — mirrors the retry-on-collision pattern already used for
  // funnel-level slug creation (app/api/funnels/route.ts POST): without it,
  // two pages with the same generated slug (e.g. both named "Thank You")
  // collide, and the second page becomes unreachable via a direct ?step=
  // link with no way to fix the slug or delete the page short of deleting
  // the whole funnel.
  let slug = slugifyForm(body.name)
  for (let i = 0; i < 10; i++) {
    const { data: existingSlug } = await db
      .from('funnel_pages')
      .select('id')
      .eq('funnel_id', id)
      .eq('slug', slug)
      .maybeSingle()
    if (!existingSlug) break
    slug = `${slugifyForm(body.name)}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data, error } = await db
    .from('funnel_pages')
    .insert({
      id: pageId,
      funnel_id: id,
      name: body.name,
      slug,
      blocks: body.blocks ?? [],
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) {
    throw new Error(String(error))
  }
  return NextResponse.json(data, { status: 201 })
})

export const PATCH = withErrorHandler('funnels/[id]/pages PATCH', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const body = await req.json()

  if (!body.pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  // AUDIT #250 — views/conversions were writable by any Team Member-role
  // caller, not just the fields the real UI actually sends
  // (name/slug/blocks/sort_order) — funnel analytics weren't tamper-proof
  // against a malicious/buggy authenticated client.
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.slug !== undefined) update.slug = body.slug
  if (body.blocks !== undefined) update.blocks = body.blocks
  if (body.sort_order !== undefined) update.sort_order = body.sort_order

  const { data, error } = await db
    .from('funnel_pages')
    .update(update)
    .eq('id', body.pageId)
    .eq('funnel_id', id)
    .select()
    .single()

  if (error || !data) {
    throw new Error(String(error) || 'Failed to update page')
  }
  return NextResponse.json(data)
})
