import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'

// public/chatbot.js (the embed script, loaded on external client sites with
// no session) fetches this to render the welcome message. GET /api/chatbots/[id]
// requires requireAdmin — correct for the admin dashboard, but that route is
// also this widget's config source, so an anonymous visitor's request always
// 401s and the customized welcome_message is silently dropped in favor of
// the embed script's hardcoded fallback. Deliberately not just removing
// requireAdmin from the [id] route instead: it returns the full row
// (system_prompt, knowledge, settings), which is real business/proprietary
// content that shouldn't be exposed to anyone who reads a chatbot id out of
// a <script data-chatbot-id> tag. Only the safe display fields are public.
export const GET = withErrorHandler('chatbots/[id]/public GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('chatbots')
    .select('welcome_message, brand_color, active, name')
    .eq('id', id)
    .single()

  if (error || !data || !data.active) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  return NextResponse.json({
    welcome_message: data.welcome_message,
    brand_color: data.brand_color,
    name: data.name,
  })
})
