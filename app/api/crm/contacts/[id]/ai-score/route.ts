import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { scoreContact } from '@/lib/ai/lead-scoring'
import { requireRole } from '@/lib/rbac'

const scoreCache = new Map<string, { score: ReturnType<typeof scoreContact> extends Promise<infer T> ? T : never; cachedAt: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000

export const GET = withErrorHandler('crm/contacts/[id]/ai-score GET', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await ctx!.params

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

  // Previously read from `contact_timeline`, a table nothing in the
  // codebase ever inserts into — engagement always came back as all-zero
  // (silently, since the query itself succeeds against an empty/nonexistent
  // table) rather than genuinely reflecting real engagement. This mirrors
  // the same real-source computation app/api/crm/contacts/[id]/timeline/
  // route.ts already uses.
  const contactEmails: string[] = contact.emails ?? []
  const [broadcastRes, proposalsRes] = await Promise.all([
    contactEmails.length > 0
      ? db.from('broadcast_recipients').select('opened_at, clicked_at').in('email', contactEmails)
      : Promise.resolve({ data: [] as { opened_at: string | null; clicked_at: string | null }[] }),
    contact.company_name
      ? db.from('proposals').select('viewed_date').eq('company', contact.company_name)
      : Promise.resolve({ data: [] as { viewed_date: string | null }[] }),
  ])
  const meetingsCount = (activities ?? []).filter(a => a.type === 'meeting').length

  const engagement: { emailsOpened: number; linksClicked: number; proposalsViewed: number; meetings: number } = {
    emailsOpened: (broadcastRes.data ?? []).filter(r => r.opened_at).length,
    linksClicked: (broadcastRes.data ?? []).filter(r => r.clicked_at).length,
    proposalsViewed: (proposalsRes.data ?? []).filter(p => p.viewed_date).length,
    meetings: meetingsCount,
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
})
