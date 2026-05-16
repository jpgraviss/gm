import { NextRequest, NextResponse } from 'next/server'

type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'active'

interface ReviewCampaign {
  id: string
  workspace_id: string
  name: string
  template: string
  audience: string
  sent_count: number
  opened_count: number
  reviews_count: number
  status: CampaignStatus
  scheduled_at: string | null
  created_at: string
}

const TEMPLATES: Record<string, string> = {
  'Happy Client Follow-Up': `Hi {{name}},\n\nThank you for choosing Graviss Marketing! We loved working with you on your recent project.\n\nWould you mind taking a moment to share your experience? Your feedback helps us improve and helps other businesses find us.\n\n{{review_link}}\n\nThank you!\nThe Graviss Marketing Team`,
  'Post-Project Review': `Hi {{name}},\n\nWe recently wrapped up your {{project}} project and we hope you are thrilled with the results!\n\nIf you have a minute, we would really appreciate a review. It only takes 30 seconds and means the world to our team.\n\n{{review_link}}\n\nBest regards,\nGraviss Marketing`,
  'Annual Check-In': `Hi {{name}},\n\nCan you believe it has been a year since we started working together? Time flies!\n\nAs we reflect on what we have accomplished, we would be grateful if you could share a quick review of your experience with us.\n\n{{review_link}}\n\nThank you for your continued trust.\nGraviss Marketing`,
}

const MOCK_CAMPAIGNS: ReviewCampaign[] = [
  {
    id: 'camp-001',
    workspace_id: 'ws-1',
    name: 'Q2 Client Satisfaction',
    template: 'Happy Client Follow-Up',
    audience: 'All Active Clients',
    sent_count: 45,
    opened_count: 32,
    reviews_count: 8,
    status: 'sent',
    scheduled_at: null,
    created_at: '2026-04-15T10:00:00Z',
  },
  {
    id: 'camp-002',
    workspace_id: 'ws-1',
    name: 'Website Redesign Follow-Up',
    template: 'Post-Project Review',
    audience: 'Web Design Clients',
    sent_count: 12,
    opened_count: 9,
    reviews_count: 4,
    status: 'sent',
    scheduled_at: null,
    created_at: '2026-05-01T14:00:00Z',
  },
  {
    id: 'camp-003',
    workspace_id: 'ws-1',
    name: 'Annual Partner Check-In',
    template: 'Annual Check-In',
    audience: 'Clients 12+ Months',
    sent_count: 0,
    opened_count: 0,
    reviews_count: 0,
    status: 'scheduled',
    scheduled_at: '2026-06-01T09:00:00Z',
    created_at: '2026-05-10T11:00:00Z',
  },
  {
    id: 'camp-004',
    workspace_id: 'ws-1',
    name: 'SEO Wins Celebration',
    template: 'Happy Client Follow-Up',
    audience: 'SEO Clients',
    sent_count: 18,
    opened_count: 14,
    reviews_count: 6,
    status: 'sent',
    scheduled_at: null,
    created_at: '2026-03-20T08:00:00Z',
  },
]

export async function GET() {
  return NextResponse.json({ campaigns: MOCK_CAMPAIGNS, templates: TEMPLATES })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, template, audience, scheduled_at } = body as {
    name: string
    template: string
    audience: string
    scheduled_at: string | null
  }

  if (!name || !template || !audience) {
    return NextResponse.json({ error: 'name, template, and audience are required' }, { status: 400 })
  }

  const campaign: ReviewCampaign = {
    id: `camp-${Date.now()}`,
    workspace_id: 'ws-1',
    name,
    template,
    audience,
    sent_count: 0,
    opened_count: 0,
    reviews_count: 0,
    status: scheduled_at ? 'scheduled' : 'draft',
    scheduled_at: scheduled_at ?? null,
    created_at: new Date().toISOString(),
  }

  MOCK_CAMPAIGNS.unshift(campaign)

  return NextResponse.json(campaign, { status: 201 })
}
