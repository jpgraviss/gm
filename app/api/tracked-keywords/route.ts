import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { addTrackedKeyword, mapTracked } from '@/lib/rank-tracker'

export async function GET(req: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  let query = db
    .from('tracked_keywords')
    .select('*')
    .order('created_at', { ascending: false })

  if (company) query = query.eq('company_name', company)

  const { data, error } = await query
  if (error) {
    console.error('[tracked-keywords GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapTracked))
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.companyName || typeof body.companyName !== 'string') {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }
  if (!body.siteUrl || typeof body.siteUrl !== 'string') {
    return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 })
  }
  if (!body.keyword || typeof body.keyword !== 'string') {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  try {
    const tracked = await addTrackedKeyword({
      companyName: body.companyName,
      companyId:   body.companyId,
      siteUrl:     body.siteUrl,
      keyword:     body.keyword,
      country:     body.country,
    })
    logAudit({
      userName: 'system',
      action:   'added_tracked_keyword',
      module:   'rank-tracker',
      type:     'action',
      metadata: { id: tracked.id, keyword: tracked.keyword, company: tracked.companyName },
    })
    return NextResponse.json(tracked, { status: 201 })
  } catch (err) {
    console.error('[tracked-keywords POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to create tracked keyword'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
