import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { decrypt } from '@/lib/encryption'

const PAGE_SIZE = 100

async function getApiKey(): Promise<string | null> {
  const envKey = process.env.HUBSPOT_API_KEY
  if (envKey) return envKey

  try {
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('hubspot')
      .eq('id', 'global')
      .maybeSingle()
    const apiKey = (data?.hubspot as { apiKey?: string })?.apiKey
    return apiKey ? decrypt(apiKey) : null
  } catch {
    return null
  }
}

interface HubSpotEngagement {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotResponse {
  results: HubSpotEngagement[]
  paging?: { next?: { after: string } }
}

function s(val: string | null | undefined): string {
  return val ?? ''
}

type EngagementType = 'notes' | 'calls' | 'emails' | 'meetings'

const ENGAGEMENT_CONFIGS: Record<EngagementType, { url: string; properties: string[]; mapType: string }> = {
  notes: {
    url: 'https://api.hubapi.com/crm/v3/objects/notes',
    properties: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', 'hs_attachment_ids'],
    mapType: 'note',
  },
  calls: {
    url: 'https://api.hubapi.com/crm/v3/objects/calls',
    properties: ['hs_call_body', 'hs_call_title', 'hs_call_duration', 'hs_call_direction', 'hs_call_disposition', 'hs_timestamp', 'hubspot_owner_id'],
    mapType: 'call',
  },
  emails: {
    url: 'https://api.hubapi.com/crm/v3/objects/emails',
    properties: ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_timestamp', 'hubspot_owner_id'],
    mapType: 'email',
  },
  meetings: {
    url: 'https://api.hubapi.com/crm/v3/objects/meetings',
    properties: ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_timestamp', 'hubspot_owner_id'],
    mapType: 'meeting',
  },
}

function mapEngagement(type: EngagementType, e: HubSpotEngagement) {
  const p = e.properties
  switch (type) {
    case 'notes':
      return {
        hubspotId: e.id,
        type: 'note',
        title: 'Note',
        body: s(p.hs_note_body),
        timestamp: s(p.hs_timestamp),
      }
    case 'calls':
      return {
        hubspotId: e.id,
        type: 'call',
        title: s(p.hs_call_title) || 'Call',
        body: s(p.hs_call_body),
        duration: p.hs_call_duration ? parseInt(p.hs_call_duration) : null,
        outcome: s(p.hs_call_disposition),
        timestamp: s(p.hs_timestamp),
      }
    case 'emails':
      return {
        hubspotId: e.id,
        type: 'email',
        title: s(p.hs_email_subject) || 'Email',
        body: s(p.hs_email_text),
        timestamp: s(p.hs_timestamp),
      }
    case 'meetings':
      return {
        hubspotId: e.id,
        type: 'meeting',
        title: s(p.hs_meeting_title) || 'Meeting',
        body: s(p.hs_meeting_body),
        timestamp: s(p.hs_meeting_start_time) || s(p.hs_timestamp),
      }
  }
}

// GET: Preview engagements from HubSpot
export const GET = withErrorHandler('integrations/hubspot/engagements GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const apiKey = await getApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HubSpot API key not configured. Add it in Settings > Integrations.' },
      { status: 400 },
    )
  }

  const { searchParams } = new URL(req.url)
  const after = searchParams.get('after') || undefined

  const allEngagements: ReturnType<typeof mapEngagement>[] = []
  let nextAfter: string | null = null

  for (const [engType, config] of Object.entries(ENGAGEMENT_CONFIGS) as [EngagementType, typeof ENGAGEMENT_CONFIGS[EngagementType]][]) {
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('properties', config.properties.join(','))
    if (after) params.set('after', after)

    const res = await fetch(`${config.url}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) continue

    const data: HubSpotResponse = await res.json()
    for (const e of data.results) {
      allEngagements.push(mapEngagement(engType, e))
    }
    if (data.paging?.next?.after) nextAfter = data.paging.next.after
  }

  return NextResponse.json({
    engagements: allEngagements,
    nextAfter,
    total: allEngagements.length,
  })
})

// POST: Import engagements from HubSpot into crm_activities
export const POST = withErrorHandler('integrations/hubspot/engagements POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const apiKey = await getApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HubSpot API key not configured. Add it in Settings > Integrations.' },
      { status: 400 },
    )
  }

  const body = (await req.json()) as { selectedIds?: string[] }
  const selectedIds = body.selectedIds ? new Set(body.selectedIds) : null

  const db = createServiceClient()

  // Get existing activity IDs to avoid duplicates (check for hs- prefixed IDs)
  const { data: existingActivities } = await db
    .from('crm_activities')
    .select('id')
    .like('id', 'hs-%')
  const existingIds = new Set((existingActivities ?? []).map((a: { id: string }) => a.id))

  // Build contact lookup for association
  const { data: allContacts } = await db.from('crm_contacts').select('id, full_name, company_id, company_name')
  const contactById = new Map<string, { id: string; name: string; companyId: string | null; companyName: string }>()
  for (const ct of allContacts ?? []) {
    contactById.set(ct.id, { id: ct.id, name: ct.full_name ?? '', companyId: ct.company_id, companyName: ct.company_name ?? '' })
  }

  let inserted = 0
  let skipped = 0
  const errors: string[] = []
  let totalFetched = 0

  for (const [engType, config] of Object.entries(ENGAGEMENT_CONFIGS) as [EngagementType, typeof ENGAGEMENT_CONFIGS[EngagementType]][]) {
    let after: string | undefined

    while (true) {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('properties', config.properties.join(','))
      params.set('associations', 'contacts')
      if (after) params.set('after', after)

      const res = await fetch(`${config.url}?${params}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (!res.ok) {
        errors.push(`HubSpot ${engType} API error: ${res.status}`)
        break
      }

      const data = await res.json() as HubSpotResponse & {
        results: (HubSpotEngagement & {
          associations?: { contacts?: { results?: { id: string }[] } }
        })[]
      }
      totalFetched += data.results.length

      for (const e of data.results) {
        if (selectedIds && !selectedIds.has(e.id)) continue

        const activityId = `hs-${engType}-${e.id}`
        if (existingIds.has(activityId)) { skipped++; continue }

        const mapped = mapEngagement(engType, e)
        if (!mapped.body && !mapped.title) { skipped++; continue }

        const timestamp = mapped.timestamp
          ? new Date(mapped.timestamp).toISOString()
          : new Date().toISOString()

        // Resolve contact association
        let contactId: string | null = null
        let contactName = ''
        let companyId: string | null = null
        let companyName = ''

        const associatedContactIds = (e as { associations?: { contacts?: { results?: { id: string }[] } } })
          .associations?.contacts?.results
        if (associatedContactIds?.[0]) {
          const match = contactById.get(associatedContactIds[0].id)
          if (match) {
            contactId = match.id
            contactName = match.name
            companyId = match.companyId
            companyName = match.companyName
          }
        }

        const { error } = await db.from('crm_activities').insert({
          id: activityId,
          type: mapped.type,
          title: mapped.title,
          body: mapped.body || null,
          company_id: companyId,
          company_name: companyName,
          contact_id: contactId,
          contact_name: contactName,
          user_name: 'HubSpot Import',
          timestamp,
          duration: 'duration' in mapped ? (mapped as { duration?: number | null }).duration ?? null : null,
          outcome: 'outcome' in mapped ? (mapped as { outcome?: string }).outcome ?? null : null,
        })

        if (error) {
          errors.push(`Insert ${engType} ${e.id}: ${error.message}`)
        } else {
          inserted++
          existingIds.add(activityId)
        }
      }

      after = data.paging?.next?.after
      if (!after) break
    }
  }

  return NextResponse.json({ inserted, updated: 0, skipped, errors, totalFetched })
})
