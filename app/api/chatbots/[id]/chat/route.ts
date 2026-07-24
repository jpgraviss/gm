import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { chatCompletion } from '@/lib/ai-client'

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
  const { message, conversationId, visitorId } = body as {
    message: string
    conversationId?: string
    visitorId?: string
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
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
  if (chatbot.website_url) {
    const origin = req.headers.get('origin') || req.headers.get('referer')
    if (origin) {
      try {
        const originHost = new URL(origin).hostname
        const allowedHost = new URL(chatbot.website_url).hostname
        if (originHost !== allowedHost) {
          return NextResponse.json({ error: 'This chatbot is not permitted on this domain' }, { status: 403 })
        }
      } catch {
        // Malformed Origin/Referer header — fall through rather than block
      }
    }
  }

  let convoId = conversationId
  let existingMessages: ConversationMessage[] = []

  if (convoId) {
    const { data: convo } = await db
      .from('chatbot_conversations')
      .select('messages, visitor_id')
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

  await db
    .from('chatbot_conversations')
    .update({
      messages: existingMessages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', convoId)

  return NextResponse.json({
    reply,
    conversationId: convoId,
    source,
  })
})

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
