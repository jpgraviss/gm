import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('chatbots')
    .select('*, chatbot_conversations(id)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[chatbots GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const bots = (data ?? []).map(b => ({
    ...b,
    conversations_count: b.chatbot_conversations?.length ?? 0,
    chatbot_conversations: undefined,
  }))

  return NextResponse.json(bots)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const row = {
    id,
    name: body.name.trim(),
    website_url: body.website_url ?? null,
    welcome_message: body.welcome_message ?? 'Hi! How can I help you today?',
    system_prompt: body.system_prompt ?? 'You are a helpful assistant.',
    knowledge: body.knowledge ?? null,
    brand_color: body.brand_color ?? '#015035',
    avatar_url: body.avatar_url ?? null,
    active: body.active ?? true,
    settings: body.settings ?? {},
  }

  const { data, error } = await db.from('chatbots').insert(row).select().single()
  if (error) {
    console.error('[chatbots POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
