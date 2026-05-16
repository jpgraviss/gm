import { NextRequest, NextResponse } from 'next/server'

interface Message {
  id: string
  conversationId: string
  text: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  status: 'delivered' | 'sent' | 'failed'
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  'conv-1': [
    { id: 'm1-1', conversationId: 'conv-1', text: 'Hi Sarah! Just following up on the SEO proposal we discussed last week.', direction: 'outbound', timestamp: '2026-05-16T10:00:00Z', status: 'delivered' },
    { id: 'm1-2', conversationId: 'conv-1', text: 'I saw it come through! The pricing looks good.', direction: 'inbound', timestamp: '2026-05-16T10:15:00Z', status: 'delivered' },
    { id: 'm1-3', conversationId: 'conv-1', text: 'Great to hear! Let me know if you have any questions about the deliverables.', direction: 'outbound', timestamp: '2026-05-16T10:20:00Z', status: 'delivered' },
    { id: 'm1-4', conversationId: 'conv-1', text: 'Will do. Can you send over the case study for the healthcare client?', direction: 'inbound', timestamp: '2026-05-16T12:45:00Z', status: 'delivered' },
    { id: 'm1-5', conversationId: 'conv-1', text: 'Absolutely! I\'ll email that over within the hour.', direction: 'outbound', timestamp: '2026-05-16T12:50:00Z', status: 'delivered' },
    { id: 'm1-6', conversationId: 'conv-1', text: 'Thanks for the proposal! I\'ll review it today.', direction: 'inbound', timestamp: '2026-05-16T14:32:00Z', status: 'delivered' },
  ],
  'conv-2': [
    { id: 'm2-1', conversationId: 'conv-2', text: 'Hi James, your April SEO report is ready.', direction: 'outbound', timestamp: '2026-05-15T09:00:00Z', status: 'delivered' },
    { id: 'm2-2', conversationId: 'conv-2', text: 'Thanks! Rankings are looking solid this month.', direction: 'inbound', timestamp: '2026-05-15T10:30:00Z', status: 'delivered' },
    { id: 'm2-3', conversationId: 'conv-2', text: 'Your monthly SEO report is ready. Check your inbox!', direction: 'outbound', timestamp: '2026-05-16T11:15:00Z', status: 'delivered' },
  ],
  'conv-3': [
    { id: 'm3-1', conversationId: 'conv-3', text: 'Emily, confirming our strategy call for Wednesday at 2pm.', direction: 'outbound', timestamp: '2026-05-14T11:00:00Z', status: 'delivered' },
    { id: 'm3-2', conversationId: 'conv-3', text: 'Got it! Looking forward to it.', direction: 'inbound', timestamp: '2026-05-14T11:30:00Z', status: 'delivered' },
    { id: 'm3-3', conversationId: 'conv-3', text: 'Can we reschedule our call to Thursday?', direction: 'inbound', timestamp: '2026-05-15T16:45:00Z', status: 'delivered' },
  ],
  'conv-4': [
    { id: 'm4-1', conversationId: 'conv-4', text: 'Marcus, the new ad campaign launched today. Here\'s the preview link.', direction: 'outbound', timestamp: '2026-05-13T14:00:00Z', status: 'delivered' },
    { id: 'm4-2', conversationId: 'conv-4', text: 'Looks sharp! Great work on the creative.', direction: 'inbound', timestamp: '2026-05-13T15:20:00Z', status: 'delivered' },
    { id: 'm4-3', conversationId: 'conv-4', text: 'Reminder: Your website maintenance window is tomorrow at 9 AM CT.', direction: 'outbound', timestamp: '2026-05-15T09:00:00Z', status: 'delivered' },
  ],
  'conv-5': [
    { id: 'm5-1', conversationId: 'conv-5', text: 'Hi Lisa! The landing page draft is live at the staging URL.', direction: 'outbound', timestamp: '2026-05-13T09:00:00Z', status: 'delivered' },
    { id: 'm5-2', conversationId: 'conv-5', text: 'Love the hero section! Can we make the headline bolder?', direction: 'inbound', timestamp: '2026-05-13T11:45:00Z', status: 'delivered' },
    { id: 'm5-3', conversationId: 'conv-5', text: 'Done! Refreshed the staging link.', direction: 'outbound', timestamp: '2026-05-14T08:30:00Z', status: 'delivered' },
    { id: 'm5-4', conversationId: 'conv-5', text: 'The new landing page looks great! One small change on the CTA button.', direction: 'inbound', timestamp: '2026-05-14T13:20:00Z', status: 'delivered' },
  ],
  'conv-6': [
    { id: 'm6-1', conversationId: 'conv-6', text: 'David, your invoice #2024-042 for $8,500 is due next week.', direction: 'outbound', timestamp: '2026-05-10T10:00:00Z', status: 'delivered' },
    { id: 'm6-2', conversationId: 'conv-6', text: 'Thanks for the reminder. I\'ll process it today.', direction: 'inbound', timestamp: '2026-05-10T14:00:00Z', status: 'delivered' },
    { id: 'm6-3', conversationId: 'conv-6', text: 'Invoice #2024-042 has been paid. Thank you!', direction: 'inbound', timestamp: '2026-05-13T10:05:00Z', status: 'delivered' },
  ],
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params
  const messages = MOCK_MESSAGES[conversationId] ?? []
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
