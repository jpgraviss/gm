import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
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
      console.error('[notifications GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[notifications GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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
      console.error('[notifications POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[notifications POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
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
      console.error('[notifications PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
