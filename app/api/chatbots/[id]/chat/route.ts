import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { anthropicChatModel } from '@/lib/anthropic'

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
    const chatMessages = existingMessages.map(m => ({ role: m.role, content: m.content }))

    let reply = ''
    let source = 'fallback'

    // Try Ollama first
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1'
    try {
      const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages,
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json() as { message?: { content: string } }
        if (ollamaData.message?.content) {
          reply = ollamaData.message.content
          source = 'ollama'
        }
      }
    } catch {
      // Ollama not available
    }

    // Fall back to Claude
    if (!reply) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (apiKey) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: anthropicChatModel(),
              max_tokens: 2048,
              system: systemPrompt,
              messages: chatMessages,
            }),
          })
          if (res.ok) {
            const data = await res.json() as { content: Array<{ type: string; text?: string }> }
            const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('')
            if (text) {
              reply = text
              source = 'claude'
            }
          }
        } catch {
          // Claude not available
        }
      }
    }

    // Ultimate fallback
    if (!reply) {
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
