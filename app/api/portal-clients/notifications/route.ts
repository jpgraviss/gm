import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('portal-clients/notifications GET', async (req) => {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  let query = db
    .from('portal_notifications')
    .select('*')
    .eq('portal_client_id', clientId)
    .order('created_at', { ascending: false })

  const unreadOnly = req.nextUrl.searchParams.get('unread')
  if (unreadOnly === 'true') {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error?.message || 'Failed to fetch notifications')
  }

  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('portal-clients/notifications POST', async (req) => {
  const { portalClientId, type, title, message, link } = await req.json()

  if (!portalClientId || !type || !title) {
    return NextResponse.json({ error: 'portalClientId, type, and title are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const id = `pn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await db.from('portal_notifications').insert({
    id,
    portal_client_id: portalClientId,
    type,
    title,
    message: message ?? null,
    link: link ?? null,
  }).select().single()

  if (error) {
    throw new Error(error?.message || 'Failed to create notification')
  }

  return NextResponse.json(data, { status: 201 })
})

export const PATCH = withErrorHandler('portal-clients/notifications PATCH', async (req) => {
  const { ids } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('portal_notifications')
    .update({ read: true })
    .in('id', ids)

  if (error) {
    throw new Error(error?.message || 'Failed to mark notifications as read')
  }

  return NextResponse.json({ success: true })
})
