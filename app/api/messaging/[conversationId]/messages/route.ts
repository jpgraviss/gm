import { NextRequest, NextResponse } from 'next/server'

interface Message {
  id: string
  conversationId: string
  text: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  status: 'delivered' | 'sent' | 'failed'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  // TODO: Replace with real Twilio integration
  await params // consume the param to avoid unused-variable lint errors
  const messages: Message[] = []
  return NextResponse.json(messages)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  const body = await req.json()
  const { text } = body as { text?: string }

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const newMessage: Message = {
    id: `m-${Date.now()}`,
    conversationId,
    text: text.trim(),
    direction: 'outbound',
    timestamp: new Date().toISOString(),
    status: 'sent',
  }

  return NextResponse.json(newMessage, { status: 201 })
}
