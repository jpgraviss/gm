import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { chatCompletion } from '@/lib/ai-client'
import { EMAIL_PATTERN } from '@/lib/validation'
import { fireAutomations } from '@/lib/automations-engine'
import { logActivity } from '@/lib/activity-log'

interface KnowledgeItem {
  id: string
  type: 'qa' | 'document' | 'url'
  question?: string
  answer?: string
  title?: string
  content?: string
  url?: string
  description?: string
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export const POST = withErrorHandler('chatbots/[id]/chat POST', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  const body = await req.json()
  const { message, conversationId, visitorId, visitorName, visitorEmail } = body as {
    message: string
    conversationId?: string
    visitorId?: string
    visitorName?: string
    visitorEmail?: string
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  // Lead capture (AUDIT #492) — the widget's pre-chat form is skippable, so
  // both fields are optional and best-effort sanitized here rather than
  // rejecting the whole message over a malformed name/email.
  const sanitizedVisitorName = sanitizeVisitorField(visitorName, 200)
  const rawVisitorEmail = sanitizeVisitorField(visitorEmail, 320)
  const sanitizedVisitorEmail = rawVisitorEmail && EMAIL_PATTERN.test(rawVisitorEmail) ? rawVisitorEmail.toLowerCase() : null
  // AUDIT — no length cap at all meant an attacker could POST arbitrarily
  // large messages (within the per-IP rate limit) to inflate input-token
  // cost, and full conversation history is resent every turn with no cap
  // either, so cost also grows unbounded with conversation length.
  const MAX_MESSAGE_LENGTH = 4000
  const MAX_HISTORY_MESSAGES = 20
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: chatbot } = await db.from('chatbots').select('*').eq('id', id).single()
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }
  if (!chatbot.active) {
    return NextResponse.json({ error: 'Chatbot is inactive' }, { status: 403 })
  }
  // AUDIT — chatbot ids are ~31 bits of randomness with a guessable
  // timestamp prefix, and neither this route nor /public checked the
  // caller's Origin/Referer against the chatbot's own configured
  // website_url — so anyone who found or brute-forced an id could embed
  // and invoke another tenant's chatbot from an unrelated site, burning
  // that tenant's AI spend and impersonating their brand off-domain. Only
  // enforced when website_url is actually configured, since it's an
  // optional field on the chatbot form.
  // AUDIT #346 — `POST /api/chatbots` now refuses to create a bot that is
  // neither bound to a site nor explicitly marked `allowAnyOrigin`, so the
  // unbound state can no longer be reached by leaving a field blank. This
  // check is unchanged for bots that predate that: a legacy bot with no
  // website_url still runs anywhere, because retroactively blocking one
  // would take a live widget off a client's site without warning. Setting a
  // website URL on it — or ticking "allow any domain" — resolves it either
  // way, and the bot list already flags which ones are unbound.
  const allowAnyOrigin = (chatbot.settings as Record<string, unknown> | null)?.allowAnyOrigin === true
  if (chatbot.website_url && !allowAnyOrigin) {
    const origin = req.headers.get('origin') || req.headers.get('referer')
    // AUDIT #616 — this only ran the check `if (origin)`, so a request with
    // no Origin/Referer at all (trivial for a direct scripted/curl caller —
    // a real browser embed always sends Origin on fetch/XHR) bypassed the
    // check entirely, defeating the cross-tenant-abuse/AI-spend threat this
    // guard exists for.
    if (!origin) {
      return NextResponse.json({ error: 'This chatbot is not permitted on this domain' }, { status: 403 })
    }
    try {
      const originHost = new URL(origin).hostname
      const allowedHost = new URL(chatbot.website_url).hostname
      if (originHost !== allowedHost) {
        return NextResponse.json({ error: 'This chatbot is not permitted on this domain' }, { status: 403 })
      }
    } catch {
      // AUDIT #633 — this used to fall through and allow the request on a
      // malformed (not merely absent) Origin/Referer, e.g. "Origin: not-a-url"
      // — just as easy for a scripted caller to send as omitting the header
      // entirely, and #616 only closed the latter. A real browser embed
      // always sends a well-formed Origin, so legitimate traffic is unaffected.
      return NextResponse.json({ error: 'This chatbot is not permitted on this domain' }, { status: 403 })
    }
  }

  let convoId = conversationId
  let existingMessages: ConversationMessage[] = []
  // Late-capture support: if an ongoing conversation already has a name/email
  // (e.g. captured earlier in the same thread), don't overwrite it with a
  // blank value from a turn that didn't resend it.
  let existingVisitorName: string | null = null
  let existingVisitorEmail: string | null = null

  if (convoId) {
    const { data: convo } = await db
      .from('chatbot_conversations')
      .select('messages, visitor_id, visitor_name, visitor_email')
      .eq('id', convoId)
      .eq('chatbot_id', id)
      .single()
    // AUDIT #264 — this only checked id+chatbot_id, no visitor-ownership
    // check, so anyone who obtained a conversationId could append to
    // another visitor's thread. The widget (public/chatbot.js) always
    // sends its localStorage-persisted visitorId alongside conversationId,
    // so a mismatch means this isn't really the same visitor — start a
    // fresh conversation instead of continuing theirs.
    if (convo && (!convo.visitor_id || convo.visitor_id === visitorId)) {
      existingMessages = (convo.messages as ConversationMessage[]) || []
      existingVisitorName = convo.visitor_name
      existingVisitorEmail = convo.visitor_email
    } else {
      convoId = undefined
    }
  }

  if (!convoId) {
    convoId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await db.from('chatbot_conversations').insert({
      id: convoId,
      chatbot_id: id,
      visitor_id: visitorId || null,
      visitor_name: sanitizedVisitorName,
      visitor_email: sanitizedVisitorEmail,
      messages: [],
      status: 'active',
    })
  }

  const userMsg: ConversationMessage = {
    role: 'user',
    content: message.trim(),
    timestamp: new Date().toISOString(),
  }
  existingMessages.push(userMsg)

  const knowledgeItems = (chatbot.settings as Record<string, unknown>)?.knowledge_items as KnowledgeItem[] | undefined
  const systemPrompt = buildSystemPrompt(chatbot.system_prompt, chatbot.knowledge, knowledgeItems)
  // Only send the AI the most recent messages — the full stored history is
  // still persisted below, but resending an ever-growing conversation on
  // every turn means cost grows unbounded with conversation length.
  const chatMessages = existingMessages.slice(-MAX_HISTORY_MESSAGES).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const result = await chatCompletion({
    system: systemPrompt,
    messages: chatMessages,
    maxTokens: 2048,
    timeoutMs: 30_000,
    feature: 'chatbot_widget',
  })

  let reply = result.text
  let source = result.source as string

  if (!reply || result.source === 'none') {
    reply = "Thanks for your message! I'm unable to process your request right now. Please contact us directly for assistance."
    source = 'fallback'
  }

  const assistantMsg: ConversationMessage = {
    role: 'assistant',
    content: reply,
    timestamp: new Date().toISOString(),
  }
  existingMessages.push(assistantMsg)

  const updatePayload: Record<string, unknown> = {
    messages: existingMessages,
    updated_at: new Date().toISOString(),
  }
  // Late-capture: fill in name/email on an already-existing conversation if
  // it didn't have one yet (e.g. visitor skipped the pre-chat form, then
  // supplied it later via the inline prompt) — but never clobber a value
  // that's already set.
  if (!existingVisitorName && sanitizedVisitorName) {
    updatePayload.visitor_name = sanitizedVisitorName
  }
  if (!existingVisitorEmail && sanitizedVisitorEmail) {
    updatePayload.visitor_email = sanitizedVisitorEmail
  }

  await db
    .from('chatbot_conversations')
    .update(updatePayload)
    .eq('id', convoId)

  // A chatbot lead used to be a dead end: a prospect could chat, hand over
  // their name and email, and that lead sat only in the chatbot's own
  // conversation list — no crm_contacts row, no automation trigger, nothing
  // reaching the pipeline unless a human happened to check that tab and
  // re-key it. Create the contact the first time an email is captured on
  // this conversation, then fire the same `contact_created` trigger every
  // other real contact-creation path fires.
  if (!existingVisitorEmail && sanitizedVisitorEmail) {
    await captureChatbotLead(db, {
      email: sanitizedVisitorEmail,
      name: sanitizedVisitorName,
      chatbotName: chatbot.name ?? 'Website chatbot',
      conversationId: convoId,
    })
  }

  return NextResponse.json({
    reply,
    conversationId: convoId,
    source,
  })
})

/**
 * Best-effort CRM capture for a chatbot-supplied lead. Never throws — a
 * capture failure must not break the visitor's chat reply, which has
 * already been generated by this point.
 */
async function captureChatbotLead(
  db: ReturnType<typeof createServiceClient>,
  lead: { email: string; name: string | null; chatbotName: string; conversationId: string },
): Promise<void> {
  try {
    // Don't create a duplicate for someone already in the CRM — a returning
    // prospect (or an existing client using the widget) should attach to
    // the contact that already exists, not spawn a second record.
    const { data: existing } = await db
      .from('crm_contacts')
      .select('id')
      .contains('emails', [lead.email])
      .maybeSingle()
    if (existing) return

    const contactId = `contact-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const { error } = await db.from('crm_contacts').insert({
      id: contactId,
      full_name: lead.name || lead.email,
      emails: [lead.email],
      phones: [],
      status: 'Lead',
      source: 'Chatbot',
      lifecycle_stage: 'Lead',
      notes: [{
        id: `note-${Date.now()}`,
        body: `Captured by ${lead.chatbotName} (conversation ${lead.conversationId})`,
        date: new Date().toISOString().split('T')[0],
        author: 'System',
      }],
    })
    if (error) {
      console.error('[chatbots/chat] lead capture failed:', error.message)
      return
    }

    logActivity({
      type: 'note',
      title: `New lead captured by ${lead.chatbotName}`,
      body: lead.email,
      contactId,
      contactName: lead.name || lead.email,
    }, db)

    fireAutomations('contact_created', {
      contactId,
      email: lead.email,
      full_name: lead.name || lead.email,
      source: 'Chatbot',
      _publicSource: true,
    })
  } catch (err) {
    console.error('[chatbots/chat] lead capture threw:', err instanceof Error ? err.message : err)
  }
}

function sanitizeVisitorField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function buildSystemPrompt(prompt: string, knowledge: string | null, knowledgeItems?: KnowledgeItem[]): string {
  let full = prompt || 'You are a helpful assistant.'

  if (knowledge) {
    full += `\n\nUse the following knowledge base to answer questions accurately:\n\n${knowledge}`
  }

  if (knowledgeItems && knowledgeItems.length > 0) {
    const qaPairs = knowledgeItems.filter(i => i.type === 'qa')
    const docs = knowledgeItems.filter(i => i.type === 'document')
    const urls = knowledgeItems.filter(i => i.type === 'url')

    if (qaPairs.length > 0) {
      full += '\n\n## Frequently Asked Questions\n'
      for (const qa of qaPairs) {
        full += `\nQ: ${qa.question}\nA: ${qa.answer}\n`
      }
    }

    if (docs.length > 0) {
      full += '\n\n## Reference Documents\n'
      for (const doc of docs) {
        full += `\n### ${doc.title}\n${doc.content}\n`
      }
    }

    if (urls.length > 0) {
      full += '\n\n## Reference Links\n'
      for (const u of urls) {
        full += `\n- ${u.url}${u.description ? ` - ${u.description}` : ''}`
      }
      full += '\n'
    }
  }

  full += '\n\nKeep responses concise and helpful. If you don\'t know the answer, say so and suggest contacting the team directly.'
  return full
}
