import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

const HUBSPOT_COMPANIES_URL = 'https://api.hubapi.com/crm/v3/objects/companies'

const PROPERTIES = [
  'name',
  'domain',
  'industry',
  'phone',
  'address',
  'address2',
  'city',
  'state',
  'zip',
  'country',
  'website',
  'description',
  'numberofemployees',
  'annualrevenue',
  'lifecyclestage',
  'hs_lead_status',
  'hubspot_owner_id',
  'type',
  'founded_year',
  'createdate',
  'lastmodifieddate',
  'notes_last_contacted',
  'notes_last_activity_date',
  'num_associated_contacts',
  'num_associated_deals',
  'hs_analytics_source',
  'hs_analytics_source_data_1',
  'linkedin_company_page',
  'twitterhandle',
  'facebookcompanypage',
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
    return (data?.hubspot as { apiKey?: string })?.apiKey || null
  } catch {
    return null
  }
}

interface HubSpotCompany {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotResponse {
  results: HubSpotCompany[]
  paging?: { next?: { after: string } }
}

function s(val: string | null | undefined): string {
  return val ?? ''
}

function normalizeSize(val?: string | null): string {
  if (!val) return '1-10'
  const n = parseInt(val.replace(/\D/g, '')) || 0
  if (n >= 500) return '500+'
  if (n >= 201) return '201-500'
  if (n >= 51) return '51-200'
  if (n >= 11) return '11-50'
  return '1-10'
}

function normalizeStatus(val?: string | null): string {
  if (!val) return 'Prospect'
  const v = val.toLowerCase()
  if (v.includes('active') || v.includes('customer') || v.includes('client')) return 'Active Client'
  if (v.includes('past') || v.includes('former')) return 'Past Client'
  if (v.includes('partner')) return 'Partner'
  if (v.includes('churn') || v.includes('lost')) return 'Churned'
  return 'Prospect'
}

function parseNum(val?: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

function mapCompanyToResponse(c: HubSpotCompany) {
  const p = c.properties
  return {
    hubspotId: c.id,
    name: s(p.name),
    domain: s(p.domain),
    industry: s(p.industry),
    phone: s(p.phone),
    address: s(p.address),
    address2: s(p.address2),
    city: s(p.city),
    state: s(p.state),
    zip: s(p.zip),
    country: s(p.country),
    website: s(p.website) || s(p.domain),
    description: s(p.description),
    numberOfEmployees: s(p.numberofemployees),
    annualRevenue: s(p.annualrevenue),
    lifecycleStage: s(p.lifecyclestage),
    leadStatus: s(p.hs_lead_status),
    type: s(p.type),
    foundedYear: s(p.founded_year),
    createDate: s(p.createdate),
    lastModifiedDate: s(p.lastmodifieddate),
    lastContacted: s(p.notes_last_contacted),
    lastActivityDate: s(p.notes_last_activity_date),
    numContacts: s(p.num_associated_contacts),
    numDeals: s(p.num_associated_deals),
    analyticsSource: s(p.hs_analytics_source),
    analyticsSourceData: s(p.hs_analytics_source_data_1),
    linkedInPage: s(p.linkedin_company_page),
    twitterHandle: s(p.twitterhandle),
    facebookPage: s(p.facebookcompanypage),
    ownerId: s(p.hubspot_owner_id),
  }
}

export const GET = withErrorHandler('integrations/hubspot/companies GET', async (req) => {
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

  const res = await fetch(`${HUBSPOT_COMPANIES_URL}?${params}`, {
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
  const companies = data.results.map(mapCompanyToResponse)

  return NextResponse.json({
    companies,
    nextAfter: data.paging?.next?.after ?? null,
    total: companies.length,
  })
})

export const POST = withErrorHandler('integrations/hubspot/companies POST', async (req) => {
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

  const { data: existing } = await db.from('crm_companies').select('name')
  const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name.toLowerCase()))

  let inserted = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []
  let after: string | undefined
  let totalFetched = 0

  while (true) {
    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('properties', PROPERTIES.join(','))
    if (after) params.set('after', after)

    const res = await fetch(`${HUBSPOT_COMPANIES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      errors.push(`HubSpot API error on page fetch: ${res.status}`)
      break
    }

    const data: HubSpotResponse = await res.json()
    totalFetched += data.results.length

    for (const c of data.results) {
      if (selectedIds && !selectedIds.has(c.id)) continue

      const p = c.properties
      const name = s(p.name).trim()
      if (!name) { skipped++; continue }

      const hqParts = [p.city, p.state, p.country].filter(Boolean)
      const hq = hqParts.join(', ')

      if (existingNames.has(name.toLowerCase())) {
        const updatePayload: Record<string, unknown> = {
          industry: p.industry || undefined,
          website: p.website || p.domain || undefined,
          phone: p.phone || undefined,
          hq: hq || undefined,
          size: normalizeSize(p.numberofemployees),
          annual_revenue: parseNum(p.annualrevenue) ?? undefined,
          status: normalizeStatus(p.lifecyclestage),
          owner: undefined,
          description: p.description || undefined,
          last_activity: p.notes_last_activity_date || undefined,
        }

        const cleanPayload = Object.fromEntries(
          Object.entries(updatePayload).filter(([, v]) => v !== undefined),
        )

        const { error } = await db
          .from('crm_companies')
          .update(cleanPayload)
          .ilike('name', name)

        if (error) {
          errors.push(`Update ${name}: ${error.message}`)
        } else {
          updated++
        }
        continue
      }

      const { error } = await db.from('crm_companies').insert({
        id: `co-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        industry: p.industry || 'Other',
        website: p.website || p.domain || null,
        phone: p.phone || null,
        hq,
        size: normalizeSize(p.numberofemployees),
        annual_revenue: parseNum(p.annualrevenue),
        status: normalizeStatus(p.lifecyclestage),
        owner: 'Jonathan Graviss',
        description: p.description || null,
        tags: [],
        contact_ids: [],
        deal_ids: [],
        total_deal_value: 0,
        created_date: new Date().toISOString().split('T')[0],
        last_activity: p.notes_last_activity_date || null,
      })

      if (error) {
        errors.push(`Insert ${name}: ${error.message}`)
      } else {
        inserted++
        existingNames.add(name.toLowerCase())
      }
    }

    after = data.paging?.next?.after
    if (!after) break
  }

  return NextResponse.json({ inserted, updated, skipped, errors, totalFetched })
})
