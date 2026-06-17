import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { chatCompletion } from '@/lib/ai-client'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const body = await req.json()
    const { message, conversationId, visitorId } = body as {
      message: string
      conversationId?: string
      visitorId?: string
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const db = createServiceClient()

    const { data: chatbot } = await db.from('chatbots').select('*').eq('id', id).single()
    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }
    if (!chatbot.active) {
      return NextResponse.json({ error: 'Chatbot is inactive' }, { status: 403 })
    }

    let convoId = conversationId
    let existingMessages: ConversationMessage[] = []

    if (convoId) {
      const { data: convo } = await db
        .from('chatbot_conversations')
        .select('messages')
        .eq('id', convoId)
        .eq('chatbot_id', id)
        .single()
      if (convo) {
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

    const systemPrompt = buildSystemPrompt(chatbot.system_prompt, chatbot.knowledge)
    const chatMessages = existingMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const result = await chatCompletion({
      system: systemPrompt,
      messages: chatMessages,
      maxTokens: 2048,
      timeoutMs: 30_000,
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
  } catch (err) {
    console.error('[chatbot/chat]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildSystemPrompt(prompt: string, knowledge: string | null): string {
  let full = prompt || 'You are a helpful assistant.'
  if (knowledge) {
    full += `\n\nUse the following knowledge base to answer questions accurately:\n\n${knowledge}`
  }
  full += '\n\nKeep responses concise and helpful. If you don\'t know the answer, say so and suggest contacting the team directly.'
  return full
}
