import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { normalizeServiceType } from '@/lib/services'
import { decrypt } from '@/lib/encryption'

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals'

const PROPERTIES = [
  'dealname',
  'dealstage',
  'amount',
  'closedate',
  'pipeline',
  'dealtype',
  'description',
  'hubspot_owner_id',
  'createdate',
  'hs_lastmodifieddate',
  'hs_deal_stage_probability',
  'hs_projected_amount',
  'hs_analytics_source',
  'hs_analytics_source_data_1',
  'notes_last_contacted',
  'notes_last_activity_date',
  'num_associated_contacts',
  'hs_num_associated_company',
]

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

interface HubSpotDeal {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotResponse {
  results: HubSpotDeal[]
  paging?: { next?: { after: string } }
}

function s(val: string | null | undefined): string {
  return val ?? ''
}

function normalizeStage(val?: string | null): string {
  if (!val) return 'Lead'
  const v = val.toLowerCase()
  if (v.includes('qualified') || v.includes('discovery')) return 'Qualified'
  if (v.includes('proposal') || v.includes('presentation')) return 'Proposal Sent'
  if (v.includes('contract') || v.includes('negotiation') || v.includes('decision')) return 'Contract Sent'
  if (v.includes('won') || v.includes('closed won') || v === 'closedwon') return 'Closed Won'
  if (v.includes('lost') || v.includes('closed lost') || v === 'closedlost') return 'Closed Lost'
  if (v.includes('appointment') || v.includes('scheduled')) return 'Qualified'
  return 'Lead'
}

function parseNum(val?: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

function stageProbability(stage: string): number {
  const map: Record<string, number> = {
    Lead: 20, Qualified: 40, 'Proposal Sent': 60,
    'Contract Sent': 80, 'Closed Won': 100, 'Closed Lost': 0,
  }
  return map[stage] ?? 20
}

function mapDealToResponse(d: HubSpotDeal) {
  const p = d.properties
  return {
    hubspotId: d.id,
    dealName: s(p.dealname),
    dealStage: s(p.dealstage),
    amount: s(p.amount),
    closeDate: s(p.closedate),
    pipeline: s(p.pipeline),
    dealType: s(p.dealtype),
    description: s(p.description),
    ownerId: s(p.hubspot_owner_id),
    createDate: s(p.createdate),
    lastModifiedDate: s(p.hs_lastmodifieddate),
    probability: s(p.hs_deal_stage_probability),
    projectedAmount: s(p.hs_projected_amount),
    analyticsSource: s(p.hs_analytics_source),
    analyticsSourceData: s(p.hs_analytics_source_data_1),
    lastContacted: s(p.notes_last_contacted),
    lastActivityDate: s(p.notes_last_activity_date),
    numContacts: s(p.num_associated_contacts),
    numCompanies: s(p.hs_num_associated_company),
  }
}

export const GET = withErrorHandler('integrations/hubspot/deals GET', async (req) => {
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

  const params = new URLSearchParams()
  params.set('limit', String(PAGE_SIZE))
  params.set('properties', PROPERTIES.join(','))
  if (after) params.set('after', after)

  const res = await fetch(`${HUBSPOT_DEALS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `HubSpot API error (${res.status}): ${text}` },
      { status: res.status },
    )
  }

  const data: HubSpotResponse = await res.json()
  const deals = data.results.map(mapDealToResponse)

  return NextResponse.json({
    deals,
    nextAfter: data.paging?.next?.after ?? null,
    total: deals.length,
  })
})

export const POST = withErrorHandler('integrations/hubspot/deals POST', async (req) => {
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

  // Build lookup maps for associations
  const { data: allCompanies } = await db.from('crm_companies').select('id, name')
  const companyByName = new Map<string, string>()
  for (const co of allCompanies ?? []) companyByName.set(co.name.toLowerCase(), co.id)

  const { data: allContacts } = await db.from('crm_contacts').select('id, full_name, emails, company_name')
  const contactByEmail = new Map<string, { id: string; name: string; email: string; phone: string; title: string }>()
  const contactByCompany = new Map<string, { id: string; name: string; email: string; phone: string; title: string }>()
  for (const ct of allContacts ?? []) {
    const entry = { id: ct.id, name: ct.full_name ?? '', email: ct.emails?.[0] ?? '', phone: '', title: '' }
    for (const e of ct.emails ?? []) contactByEmail.set(e.toLowerCase(), entry)
    if (ct.company_name) contactByCompany.set(ct.company_name.toLowerCase(), entry)
  }

  // AUDIT #482 — used to key update-detection off a composite of mutable
  // fields (`company|stage|value`), so any real deal progression (stage
  // change, amount change — the entire point of syncing a pipeline)
  // recomputed a key that no longer matched the stored one and inserted a
  // duplicate row instead of updating. Mirrors the stable-id pattern #415
  // established for crm_activities/hs_last_modified: look up by the new
  // `hubspot_deal_id` column (see add_deals_hubspot_deal_id.sql) first.
  //
  // Every row imported before this fix has hubspot_deal_id = NULL — that's
  // "unknown, not yet linked" rather than "definitely a new deal", so for
  // rows still missing the id we fall back to the old composite-key match
  // ONCE to find the correct existing row and backfill hubspot_deal_id
  // onto it below, instead of creating a duplicate. Rows that already have
  // hubspot_deal_id are excluded from the fallback map so a stale
  // composite match can never steal a deal already linked to a different
  // HubSpot id.
  const { data: existing } = await db.from('deals').select('id, company, stage, value, hubspot_deal_id')
  const existingByHubspotId = new Map<string, string>()
  const existingByKey = new Map<string, string>()
  for (const d of existing ?? []) {
    if (d.hubspot_deal_id) {
      existingByHubspotId.set(d.hubspot_deal_id, d.id)
    } else {
      const key = `${(d.company ?? '').toLowerCase()}|${(d.stage ?? '').toLowerCase()}|${d.value}`
      existingByKey.set(key, d.id)
    }
  }

  let inserted = 0
  let updated = 0
  const skipped = 0
  const errors: string[] = []
  let after: string | undefined
  let totalFetched = 0

  while (true) {
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('properties', PROPERTIES.join(','))
    if (after) params.set('after', after)

    const res = await fetch(`${HUBSPOT_DEALS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      errors.push(`HubSpot API error on page fetch: ${res.status}`)
      break
    }

    const data: HubSpotResponse = await res.json()
    totalFetched += data.results.length

    for (const d of data.results) {
      if (selectedIds && !selectedIds.has(d.id)) continue

      const p = d.properties
      const dealName = s(p.dealname).trim()
      const company = dealName || '(Unnamed Deal)'
      const stage = normalizeStage(p.dealstage)
      const value = parseNum(p.amount) ?? 0

      // Resolve contact association — match by company name
      const contactMatch = contactByCompany.get(company.toLowerCase()) ??
        { id: '', name: '', email: '', phone: '', title: '' }

      // Resolve company_id
      const companyId = companyByName.get(company.toLowerCase()) ?? null

      const probability = parseNum(p.hs_deal_stage_probability) ?? stageProbability(stage)
      const serviceType = normalizeServiceType(p.dealtype, p.dealname)
      const closeDate = p.closedate || null
      const lastActivity = p.notes_last_activity_date || new Date().toISOString().split('T')[0]
      const notes = p.description ? [p.description] : []

      // Primary lookup: stable HubSpot deal id. Fallback (only reached for
      // rows never yet linked): the old mutable composite key, used solely
      // to find-and-backfill the correct row this one time.
      const key = `${company.toLowerCase()}|${stage.toLowerCase()}|${value}`
      const existingId = existingByHubspotId.get(d.id) ?? existingByKey.get(key)

      if (existingId) {
        // ── Update existing deal ──────────────────────────────────────
        // hubspot_deal_id is written on every update (not just inserts) so
        // a pre-fix row matched via the composite-key fallback above gets
        // backfilled and uses the stable id on every subsequent sync.
        const { error } = await db.from('deals').update({
          hubspot_deal_id: d.id,
          stage,
          value,
          contact: contactMatch,
          company_id: companyId,
          service_type: serviceType,
          close_date: closeDate,
          probability,
          last_activity: lastActivity,
          notes,
        }).eq('id', existingId)

        if (error) {
          errors.push(`Update deal "${dealName}": ${error.message}`)
        } else {
          updated++
          existingByHubspotId.set(d.id, existingId)
        }
        continue
      }

      const newId = `deal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const { error } = await db.from('deals').insert({
        id: newId,
        hubspot_deal_id: d.id,
        company,
        company_id: companyId,
        contact: contactMatch,
        contact_id: contactMatch.id || null,
        stage,
        value,
        service_type: serviceType,
        close_date: closeDate,
        assigned_rep: 'Jonathan Graviss',
        probability,
        notes,
        last_activity: lastActivity,
      })

      if (error) {
        errors.push(`Insert deal "${dealName}": ${error.message}`)
      } else {
        inserted++
        existingByHubspotId.set(d.id, newId)
      }
    }

    after = data.paging?.next?.after
    if (!after) break
  }

  return NextResponse.json({ inserted, updated, skipped, errors, totalFetched })
})
