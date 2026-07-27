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

// `hs_lastmodifieddate` is the standard freshness property HubSpot exposes
// on every engagement object (notes/calls/emails/meetings all use the same
// `hs_`-prefixed convention as deals — see AUDIT.md #415); it wasn't
// previously fetched here since the import only ever did an existence
// check, never a freshness comparison.
const ENGAGEMENT_CONFIGS: Record<EngagementType, { url: string; properties: string[]; mapType: string }> = {
  notes: {
    url: 'https://api.hubapi.com/crm/v3/objects/notes',
    properties: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id', 'hs_attachment_ids', 'hs_lastmodifieddate'],
    mapType: 'note',
  },
  calls: {
    url: 'https://api.hubapi.com/crm/v3/objects/calls',
    properties: ['hs_call_body', 'hs_call_title', 'hs_call_duration', 'hs_call_direction', 'hs_call_disposition', 'hs_timestamp', 'hubspot_owner_id', 'hs_lastmodifieddate'],
    mapType: 'call',
  },
  emails: {
    url: 'https://api.hubapi.com/crm/v3/objects/emails',
    properties: ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_timestamp', 'hubspot_owner_id', 'hs_lastmodifieddate'],
    mapType: 'email',
  },
  meetings: {
    url: 'https://api.hubapi.com/crm/v3/objects/meetings',
    properties: ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time', 'hs_timestamp', 'hubspot_owner_id', 'hs_lastmodifieddate'],
    mapType: 'meeting',
  },
}

function mapEngagement(type: EngagementType, e: HubSpotEngagement) {
  const p = e.properties
  const lastModifiedDate = s(p.hs_lastmodifieddate)
  switch (type) {
    case 'notes':
      return {
        hubspotId: e.id,
        type: 'note',
        title: 'Note',
        body: s(p.hs_note_body),
        timestamp: s(p.hs_timestamp),
        lastModifiedDate,
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
        lastModifiedDate,
      }
    case 'emails':
      return {
        hubspotId: e.id,
        type: 'email',
        title: s(p.hs_email_subject) || 'Email',
        body: s(p.hs_email_text),
        timestamp: s(p.hs_timestamp),
        lastModifiedDate,
      }
    case 'meetings':
      return {
        hubspotId: e.id,
        type: 'meeting',
        title: s(p.hs_meeting_title) || 'Meeting',
        body: s(p.hs_meeting_body),
        timestamp: s(p.hs_meeting_start_time) || s(p.hs_timestamp),
        lastModifiedDate,
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

  // AUDIT #415 — used to be a bare `select('id')` existence check, which
  // meant any hs-prefixed id already present was skipped forever with no
  // way to re-process a row a rep later edited in HubSpot. Also selecting
  // hs_last_modified (see add_crm_activities_hs_last_modified.sql) lets
  // the loop below tell an unchanged re-fetch from a genuine edit.
  const { data: existingActivities } = await db
    .from('crm_activities')
    .select('id, hs_last_modified')
    .like('id', 'hs-%')
  const existingMeta = new Map(
    (existingActivities ?? []).map((a: { id: string; hs_last_modified: string | null }) => [a.id, a.hs_last_modified]),
  )

  // Build contact lookup for association
  const { data: allContacts } = await db.from('crm_contacts').select('id, full_name, company_id, company_name')
  const contactById = new Map<string, { id: string; name: string; companyId: string | null; companyName: string }>()
  for (const ct of allContacts ?? []) {
    contactById.set(ct.id, { id: ct.id, name: ct.full_name ?? '', companyId: ct.company_id, companyName: ct.company_name ?? '' })
  }

  let inserted = 0
  let updated = 0
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
        const mapped = mapEngagement(engType, e)
        if (!mapped.body && !mapped.title) { skipped++; continue }

        // AUDIT #415 — an id already present in existingMeta used to be
        // skipped unconditionally forever. Now only skip when we can
        // positively confirm the stored copy is still current: the
        // incoming hs_lastmodifieddate is present AND no newer than what
        // we stored last time. A missing stored value (every row imported
        // before this fix, since the column above starts out NULL) is
        // treated as "unknown, not confirmed current" rather than
        // "definitely stale" — so it falls through to the update branch,
        // which backfills hs_last_modified for next time instead of
        // leaving the row stuck unskippable-but-uncomparable forever.
        const isExisting = existingMeta.has(activityId)
        const storedLastModified = existingMeta.get(activityId)
        if (isExisting && storedLastModified && mapped.lastModifiedDate && mapped.lastModifiedDate <= storedLastModified) {
          skipped++
          continue
        }
        // No freshness signal from HubSpot at all and we've already
        // recorded this row — nothing to act on, preserve prior behavior.
        if (isExisting && !mapped.lastModifiedDate) {
          skipped++
          continue
        }

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

        const hsLastModified = mapped.lastModifiedDate
          ? new Date(mapped.lastModifiedDate).toISOString()
          : null

        if (isExisting) {
          // ── Update existing engagement ───────────────────────────────
          const { error } = await db.from('crm_activities').update({
            type: mapped.type,
            title: mapped.title,
            body: mapped.body || null,
            company_id: companyId,
            company_name: companyName,
            contact_id: contactId,
            contact_name: contactName,
            duration: 'duration' in mapped ? (mapped as { duration?: number | null }).duration ?? null : null,
            outcome: 'outcome' in mapped ? (mapped as { outcome?: string }).outcome ?? null : null,
            hs_last_modified: hsLastModified,
          }).eq('id', activityId)

          if (error) {
            errors.push(`Update ${engType} ${e.id}: ${error.message}`)
          } else {
            updated++
            existingMeta.set(activityId, hsLastModified)
          }
          continue
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
          hs_last_modified: hsLastModified,
        })

        if (error) {
          errors.push(`Insert ${engType} ${e.id}: ${error.message}`)
        } else {
          inserted++
          existingMeta.set(activityId, hsLastModified)
        }
      }

      after = data.paging?.next?.after
      if (!after) break
    }
  }

  return NextResponse.json({ inserted, updated, skipped, errors, totalFetched })
})
