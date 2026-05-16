import { NextRequest, NextResponse } from 'next/server'

interface MockConversation {
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

const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: 'conv-1',
    contact: { id: 'c1', name: 'Sarah Mitchell', phone: '+1 (512) 555-0142', company: 'Summit Capital' },
    lastMessage: { text: 'Thanks for the proposal! I\'ll review it today.', timestamp: '2026-05-16T14:32:00Z', direction: 'inbound' },
    unreadCount: 2,
  },
  {
    id: 'conv-2',
    contact: { id: 'c2', name: 'James Rodriguez', phone: '+1 (830) 555-0198', company: 'BlueStar Logistics' },
    lastMessage: { text: 'Your monthly SEO report is ready. Check your inbox!', timestamp: '2026-05-16T11:15:00Z', direction: 'outbound' },
    unreadCount: 0,
  },
  {
    id: 'conv-3',
    contact: { id: 'c3', name: 'Emily Chen', phone: '+1 (210) 555-0267', company: 'Coastal Realty' },
    lastMessage: { text: 'Can we reschedule our call to Thursday?', timestamp: '2026-05-15T16:45:00Z', direction: 'inbound' },
    unreadCount: 1,
  },
  {
    id: 'conv-4',
    contact: { id: 'c4', name: 'Marcus Thompson', phone: '+1 (713) 555-0331', company: 'ProVenture LLC' },
    lastMessage: { text: 'Reminder: Your website maintenance window is tomorrow at 9 AM CT.', timestamp: '2026-05-15T09:00:00Z', direction: 'outbound' },
    unreadCount: 0,
  },
  {
    id: 'conv-5',
    contact: { id: 'c5', name: 'Lisa Park', phone: '+1 (469) 555-0412', company: 'Harvest Foods' },
    lastMessage: { text: 'The new landing page looks great! One small change on the CTA button.', timestamp: '2026-05-14T13:20:00Z', direction: 'inbound' },
    unreadCount: 3,
  },
  {
    id: 'conv-6',
    contact: { id: 'c6', name: 'David Nguyen', phone: '+1 (956) 555-0589', company: 'Metro Health Group' },
    lastMessage: { text: 'Invoice #2024-042 has been paid. Thank you!', timestamp: '2026-05-13T10:05:00Z', direction: 'inbound' },
    unreadCount: 0,
  },
]

export async function GET() {
  return NextResponse.json(MOCK_CONVERSATIONS)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { contactName, contactPhone, company } = body as { contactName?: string; contactPhone?: string; company?: string }

  if (!contactPhone) {
    return NextResponse.json({ error: 'contactPhone is required' }, { status: 400 })
  }

  const existing = MOCK_CONVERSATIONS.find(c => c.contact.phone === contactPhone)
  if (existing) {
    return NextResponse.json(existing)
  }

  const newConversation: MockConversation = {
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
