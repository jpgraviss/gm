import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { scoreContact } from '@/lib/ai/lead-scoring'

const scoreCache = new Map<string, { score: ReturnType<typeof scoreContact> extends Promise<infer T> ? T : never; cachedAt: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cached = scoreCache.get(id)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json(cached.score)
  }

  const db = createServiceClient()

  const { data: contact } = await db
    .from('crm_contacts')
    .select('id, full_name, company_name, title, emails, lifecycle_stage, lead_status, last_activity, tags')
    .eq('id', id)
    .single()

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const { data: activities } = await db
    .from('crm_activities')
    .select('type, timestamp, outcome')
    .eq('contact_id', id)
    .order('timestamp', { ascending: false })
    .limit(50)

  const { data: deals } = await db
    .from('deals')
    .select('stage, value, probability, last_activity')
    .eq('company', contact.company_name)

  let engagement: { emailsOpened: number; linksClicked: number; proposalsViewed: number; meetings: number } | undefined
  try {
    const { data: activityTypes } = await db
      .from('crm_activities')
      .select('type')
      .eq('contact_id', id)

    const { count: broadcastOpens } = await db
      .from('broadcast_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', id)
      .eq('status', 'opened')

    const { count: proposalCount } = await db
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', id)

    const { count: contractCount } = await db
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', id)

    const meetingCount = (activityTypes ?? []).filter(a => a.type === 'meeting').length
    const linkClicks = (activityTypes ?? []).filter(a => a.type === 'link_clicked').length

    engagement = {
      emailsOpened: broadcastOpens ?? 0,
      linksClicked: linkClicks,
      proposalsViewed: (proposalCount ?? 0) + (contractCount ?? 0),
      meetings: meetingCount,
    }
  } catch {
    // engagement data unavailable
  }

  const result = await scoreContact(
    {
      id: contact.id,
      fullName: contact.full_name,
      companyName: contact.company_name,
      title: contact.title ?? '',
      emails: contact.emails ?? [],
      lifecycleStage: contact.lifecycle_stage,
      leadStatus: contact.lead_status,
      lastActivity: contact.last_activity,
      tags: contact.tags,
    },
    (activities ?? []).map(a => ({
      type: a.type,
      timestamp: a.timestamp,
      outcome: a.outcome,
    })),
    (deals ?? []).map(d => ({
      stage: d.stage ?? 'Lead',
      value: d.value ?? 0,
      probability: d.probability ?? 0,
      lastActivity: d.last_activity ?? '',
    })),
    engagement,
  )

  scoreCache.set(id, { score: result, cachedAt: Date.now() })

  return NextResponse.json(result)
}
