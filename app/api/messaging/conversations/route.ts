import { NextRequest, NextResponse } from 'next/server'

interface Conversation {
  id: string
  contact: {
    id: string
    name: string
    phone: string
    company: string
  }
  lastMessage: {
    text: string
    timestamp: string
    direction: 'inbound' | 'outbound'
  }
  unreadCount: number
}

export async function GET() {
  // TODO: Replace with real Twilio integration
  const conversations: Conversation[] = []
  return NextResponse.json(conversations)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { contactName, contactPhone, company } = body as { contactName?: string; contactPhone?: string; company?: string }

  if (!contactPhone) {
    return NextResponse.json({ error: 'contactPhone is required' }, { status: 400 })
  }

  const newConversation: Conversation = {
    id: `conv-${Date.now()}`,
    contact: {
      id: `c-${Date.now()}`,
      name: contactName ?? 'Unknown',
      phone: contactPhone,
      company: company ?? '',
    },
    lastMessage: { text: '', timestamp: new Date().toISOString(), direction: 'outbound' },
    unreadCount: 0,
  }

  return NextResponse.json(newConversation, { status: 201 })
}
