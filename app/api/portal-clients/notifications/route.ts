import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAuthenticatedEmail } from '@/lib/admin-auth'
import { isStaffCaller } from '@/lib/portal-auth'
import { withErrorHandler } from '@/lib/api-handler'

// A portal client may only read/write their OWN notification feed; staff may
// act on behalf of any client. Without this, clientId is a fully caller-
// controlled query param / body field with no ownership check at all.
async function verifyNotificationAccess(req: NextRequest, clientId: string): Promise<NextResponse | null> {
  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (await isStaffCaller(req)) return null

  const db = createServiceClient()
  const { data: client } = await db.from('portal_clients').select('id, email').eq('id', clientId).maybeSingle()
  if (!client || client.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  return null
}

export const GET = withErrorHandler('portal-clients/notifications GET', async (req) => {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  const denied = await verifyNotificationAccess(req, clientId)
  if (denied) return denied

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
  if (!(await isStaffCaller(req))) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  }

  const body = await req.json()
  const portalClientId = body.portalClientId ?? body.portal_client_id
  const { type, title, message, link } = body

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

  const email = await getAuthenticatedEmail(req)
  if (!email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const db = createServiceClient()

  if (!(await isStaffCaller(req))) {
    // Non-staff callers may only mark their OWN notifications read.
    const { data: client } = await db.from('portal_clients').select('id').ilike('email', email).maybeSingle()
    const { count } = await db
      .from('portal_notifications')
      .select('id', { count: 'exact', head: true })
      .in('id', ids)
      .neq('portal_client_id', client?.id ?? '')
    if (!client || (count ?? 0) > 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  const { error } = await db
    .from('portal_notifications')
    .update({ read: true })
    .in('id', ids)

  if (error) {
    throw new Error(error?.message || 'Failed to mark notifications as read')
  }

  return NextResponse.json({ success: true })
})
