import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { addTrackedKeyword, addTrackedKeywordsBulk, mapTracked } from '@/lib/rank-tracker'

export async function GET(req: NextRequest) {
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const tag = searchParams.get('tag')
  const posMin = searchParams.get('posMin')
  const posMax = searchParams.get('posMax')
  const clientId = searchParams.get('clientId')

  let query = db
    .from('tracked_keywords')
    .select('*')
    .order('created_at', { ascending: false })

  if (company) query = query.eq('company_name', company)
  if (clientId) query = query.eq('company_id', clientId)
  if (tag) query = query.contains('tags', [tag])
  if (posMin) query = query.gte('current_position', parseFloat(posMin))
  if (posMax) query = query.lte('current_position', parseFloat(posMax))

  const { data, error } = await query
  if (error) {
    console.error('[rank-tracker keywords GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(mapTracked))
}

export async function POST(req: NextRequest) {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()

  if (Array.isArray(body.keywords) && body.keywords.length > 0) {
    if (!body.companyName || !body.siteUrl) {
      return NextResponse.json({ error: 'companyName and siteUrl are required' }, { status: 400 })
    }
    try {
      const created = await addTrackedKeywordsBulk({
        companyName:  body.companyName,
        companyId:    body.companyId,
        siteUrl:      body.siteUrl,
        keywords:     body.keywords,
        country:      body.country,
        tags:         body.tags,
        targetUrl:    body.targetUrl,
        searchEngine: body.searchEngine,
        location:     body.location,
      })
      logAudit({
        userName: 'system',
        action:   'bulk_added_tracked_keywords',
        module:   'rank-tracker',
        type:     'action',
        metadata: { count: created.length, company: body.companyName },
      })
      return NextResponse.json(created, { status: 201 })
    } catch (err) {
      console.error('[rank-tracker keywords POST bulk]', err)
      const message = err instanceof Error ? err.message : 'Failed to bulk add'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (!body.companyName || !body.siteUrl || !body.keyword) {
    return NextResponse.json({ error: 'companyName, siteUrl, and keyword are required' }, { status: 400 })
  }

  try {
    const tracked = await addTrackedKeyword({
      companyName:  body.companyName,
      companyId:    body.companyId,
      siteUrl:      body.siteUrl,
      keyword:      body.keyword,
      country:      body.country,
      tags:         body.tags,
      targetUrl:    body.targetUrl,
      searchEngine: body.searchEngine,
      location:     body.location,
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
    console.error('[rank-tracker keywords POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to create tracked keyword'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
