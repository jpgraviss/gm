import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const db = createServiceClient()

  let query = db
    .from('chatbot_conversations')
    .select('*')
    .eq('chatbot_id', id)
    .order('updated_at', { ascending: false })

  if (status === 'flagged') {
    query = query.eq('flagged', true)
  } else if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[chatbot/conversations GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let results = data ?? []
  if (search) {
    const q = search.toLowerCase()
    results = results.filter(c => {
      const msgs = (c.messages as Array<{ content: string }>) || []
      return msgs.some(m => m.content?.toLowerCase().includes(q)) ||
        c.visitor_id?.toLowerCase().includes(q) ||
        c.visitor_name?.toLowerCase().includes(q) ||
        c.visitor_email?.toLowerCase().includes(q)
    })
  }

  return NextResponse.json(results)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { conversationId, flagged, status: newStatus } = body as {
    conversationId: string
    flagged?: boolean
    status?: string
  }

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof flagged === 'boolean') updates.flagged = flagged
  if (newStatus) updates.status = newStatus

  const { data, error } = await db
    .from('chatbot_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('chatbot_id', id)
    .select()
    .single()

  if (error) {
    console.error('[chatbot/conversations PATCH]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('chatbot_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('chatbot_id', id)

  if (error) {
    console.error('[chatbot/conversations DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
