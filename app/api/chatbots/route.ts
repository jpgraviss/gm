import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

// /api/chatbots/ is in proxy.ts's PUBLIC_PREFIXES (needed so the public
// chat widget can reach [id]/chat unauthenticated) — that only bypasses
// the outer session gate, not this route's own requireAdmin check below,
// which still correctly 401s a real anonymous caller.
export const GET = withErrorHandler('chatbots GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('chatbots')
    .select('*, chatbot_conversations(id)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const bots = (data ?? []).map(b => ({
    ...b,
    conversations_count: b.chatbot_conversations?.length ?? 0,
    chatbot_conversations: undefined,
  }))

  return NextResponse.json(bots)
})

export const POST = withErrorHandler('chatbots POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = await req.json()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // AUDIT #346 — a chatbot with no `website_url` is origin-bound to nothing,
  // so anyone who finds or brute-forces its id (~31 bits, timestamp-prefixed)
  // can embed it on any site, burn this tenant's AI spend and impersonate
  // their brand off-domain. That state was previously reachable by simply
  // leaving a field blank.
  //
  // "Embed anywhere" is a legitimate thing to want, so this doesn't remove
  // it — it just stops it happening by accident. A new bot must either name
  // the site it belongs on, or say `allowAnyOrigin` out loud. Existing bots
  // are untouched: this is creation-time only, and the runtime check below
  // still treats a legacy bot with neither set exactly as it did before, so
  // nothing live breaks.
  const settings = (body.settings ?? {}) as Record<string, unknown>
  const websiteUrl = typeof body.website_url === 'string' ? body.website_url.trim() : ''
  if (!websiteUrl && settings.allowAnyOrigin !== true) {
    return NextResponse.json(
      { error: 'Set a website URL so this chatbot only works on your own site, or explicitly allow embedding on any domain.' },
      { status: 400 },
    )
  }

  const db = createServiceClient()
  const id = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const row = {
    id,
    name: body.name.trim(),
    website_url: websiteUrl || null,
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
    throw new Error(error.message)
  }
  return NextResponse.json(data, { status: 201 })
})
