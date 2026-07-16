import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('intelligence/identify GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const params = new URL(req.url).searchParams
  const visitorId = params.get('visitor_id')
  const limit = parseInt(params.get('limit') ?? '50')
  const offset = parseInt(params.get('offset') ?? '0')
  const identified = params.get('identified')
  const search = params.get('search')

  const db = createServiceClient()

  if (visitorId) {
    // Get single visitor with their events
    const { data: visitor } = await db
      .from('gi_visitors')
      .select('*')
      .eq('visitor_id', visitorId)
      .single()

    const { data: events } = await db
      .from('gi_events')
      .select('*')
      .eq('visitor_id', visitorId)
      .order('timestamp', { ascending: false })
      .limit(100)

    return NextResponse.json({ visitor, events: events ?? [] })
  }

  // List visitors
  let query = db
    .from('gi_visitors')
    .select('*', { count: 'exact' })
    .order('last_seen', { ascending: false })
    .range(offset, offset + limit - 1)

  if (identified === 'true') {
    query = query.not('email', 'is', null)
  }

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,company.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to fetch visitors')
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
})
