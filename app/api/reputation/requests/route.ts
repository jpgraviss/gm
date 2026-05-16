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

export async function GET() {
  // TODO: Replace with real data from database
  const campaigns: ReviewCampaign[] = []
  const templates: Record<string, string> = {}
  return NextResponse.json({ campaigns, templates })
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

  return NextResponse.json(campaign, { status: 201 })
}
