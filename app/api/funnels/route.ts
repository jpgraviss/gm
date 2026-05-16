import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { slugifyForm } from '@/lib/forms'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('funnels')
    .select('*, funnel_pages(id, name, slug, sort_order, views, conversions)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[funnels GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const funnels = (data ?? []).map((f) => {
    const pages = (f.funnel_pages ?? []) as Array<{
      id: string; name: string; slug: string; sort_order: number; views: number; conversions: number
    }>
    const totalViews = pages.reduce((s, p) => s + (p.views ?? 0), 0)
    const totalConversions = pages.reduce((s, p) => s + (p.conversions ?? 0), 0)
    return {
      id: f.id,
      name: f.name,
      slug: f.slug,
      status: f.status,
      pageCount: pages.length,
      views: totalViews,
      conversions: totalConversions,
      conversionRate: totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0.0',
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }
  })

  return NextResponse.json(funnels)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const funnelId = `fnl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  let slug = slugifyForm(body.name)
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await db.from('funnels').select('id').eq('slug', slug).maybeSingle()
    if (!existing) break
    slug = `${slugifyForm(body.name)}-${Math.random().toString(36).slice(2, 6)}`
  }

  const { data, error } = await db
    .from('funnels')
    .insert({
      id: funnelId,
      workspace_id: body.workspaceId ?? null,
      name: body.name,
      slug,
      status: 'Draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[funnels POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pageId = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  await db.from('funnel_pages').insert({
    id: pageId,
    funnel_id: funnelId,
    name: 'Landing Page',
    slug: 'landing',
    blocks: [],
    sort_order: 0,
  })

  logAudit({ userName: 'system', action: 'created_funnel', module: 'funnels', type: 'action', metadata: { funnelId: data.id, name: data.name } })
  return NextResponse.json({ ...data, pages: [{ id: pageId, name: 'Landing Page', slug: 'landing', blocks: [], sort_order: 0, views: 0, conversions: 0 }] }, { status: 201 })
}
