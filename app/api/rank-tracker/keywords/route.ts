import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { addTrackedKeyword, addTrackedKeywordsBulk, mapTracked } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'
import { validate, validationError } from '@/lib/validation'

export const GET = withErrorHandler('rank-tracker/keywords GET', async (req) => {
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
    throw new Error(error?.message || 'Failed to fetch keywords')
  }
  return NextResponse.json((data ?? []).map(mapTracked))
})

export const POST = withErrorHandler('rank-tracker/keywords POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()

  if (Array.isArray(body.keywords) && body.keywords.length > 0) {
    if (!body.companyName || !body.siteUrl) {
      return NextResponse.json({ error: 'companyName and siteUrl are required' }, { status: 400 })
    }
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
  }

  const v = validate(body, {
    keyword:     { required: true, type: 'string', maxLength: 500 },
    siteUrl:     { required: true, type: 'string', maxLength: 500 },
    companyName: { required: true, type: 'string', maxLength: 200 },
    country:     { type: 'string', maxLength: 10 },
  })
  if (!v.valid) return validationError(v.error)

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
})
