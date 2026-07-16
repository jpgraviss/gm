import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts'

// ─── All standard HubSpot contact properties ────────────────────────────────
const PROPERTIES = [
  // Name & basics
  'firstname',
  'lastname',
  'email',
  'phone',
  'mobilephone',
  // Company & role
  'company',
  'jobtitle',
  'industry',
  'annualrevenue',
  // Status & lifecycle
  'hs_lead_status',
  'lifecyclestage',
  // Address
  'address',
  'city',
  'state',
  'zip',
  'country',
  // Web & social
  'website',
  'hs_linkedinbio',
  'twitterhandle',
  'facebookfanpage',
  // Dates
  'date_of_birth',
  'createdate',
  'lastmodifieddate',
  // Analytics
  'hs_analytics_source',
  'hs_analytics_source_data_1',
  // Activity
  'notes_last_contacted',
  'notes_last_activity_date',
  'num_contacted_notes',
  // Email & marketing
  'hs_email_domain',
  'hs_marketable_status',
  // Ownership & association
  'hubspot_owner_id',
  'associatedcompanyid',
]

const PAGE_SIZE = 100

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotResponse {
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

/** Safe string accessor — returns empty string for null/undefined */
function s(val: string | null | undefined): string {
  return val ?? ''
}

function normalizeLifecycle(val?: string | null): string | null {
  if (!val) return null
  const v = val.toLowerCase()
  if (v.includes('lead') || v.includes('new') || v.includes('subscriber')) return 'lead'
  if (v.includes('opport') || v.includes('qualified') || v.includes('open')) return 'opportunity'
  if (v.includes('client') || v.includes('customer') || v.includes('won')) return 'client'
  return 'other'
}

function normalizeLeadStatus(val?: string | null): string | null {
  if (!val) return null
  const v = val.toLowerCase().replace(/[\s-]+/g, '_')
  const known = [
    'new', 'open', 'in_progress', 'open_deal',
    'unqualified', 'attempted_to_contact', 'connected', 'bad_timing',
  ]
  return known.includes(v) ? v : val.toLowerCase()
}

/** Map a HubSpot contact to the GET response shape (camelCase) */
function mapContactToResponse(c: HubSpotContact) {
  const p = c.properties
  return {
    hubspotId: c.id,
    // Name & basics
    firstName: s(p.firstname),
    lastName: s(p.lastname),
    email: s(p.email),
    phone: s(p.phone),
    mobilePhone: s(p.mobilephone),
    // Company & role
    companyName: s(p.company),
    title: s(p.jobtitle),
    industry: s(p.industry),
    annualRevenue: s(p.annualrevenue),
    // Status & lifecycle
    leadStatus: s(p.hs_lead_status),
    lifecycleStage: s(p.lifecyclestage),
    // Address
    address: s(p.address),
    city: s(p.city),
    state: s(p.state),
    zip: s(p.zip),
    country: s(p.country),
    // Web & social
    website: s(p.website),
    linkedInUrl: s(p.hs_linkedinbio),
    twitterHandle: s(p.twitterhandle),
    facebookPage: s(p.facebookfanpage),
    // Dates
    dateOfBirth: s(p.date_of_birth),
    createDate: s(p.createdate),
    lastModifiedDate: s(p.lastmodifieddate),
    // Analytics
    analyticsSource: s(p.hs_analytics_source),
    analyticsSourceData: s(p.hs_analytics_source_data_1),
    // Activity
    lastContacted: s(p.notes_last_contacted),
    lastActivityDate: s(p.notes_last_activity_date),
    numContactedNotes: s(p.num_contacted_notes),
    // Email & marketing
    emailDomain: s(p.hs_email_domain),
    marketableStatus: s(p.hs_marketable_status),
    // Ownership & association
    hubspotOwnerId: s(p.hubspot_owner_id),
    associatedCompanyId: s(p.associatedcompanyid),
  }
}

/**
 * Build the `hubspot_data` JSONB blob for fields that have no direct
 * crm_contacts column.  Only includes non-empty values.
 */
function buildHubspotData(p: Record<string, string | null>): Record<string, string> | null {
  const extras: Record<string, string> = {}

  const mapping: Record<string, string> = {
    mobilephone: 'mobilePhone',
    industry: 'industry',
    annualrevenue: 'annualRevenue',
    address: 'address',
    city: 'city',
    state: 'state',
    zip: 'zip',
    country: 'country',
    twitterhandle: 'twitterHandle',
    facebookfanpage: 'facebookPage',
    date_of_birth: 'dateOfBirth',
    createdate: 'hubspotCreateDate',
    lastmodifieddate: 'hubspotLastModified',
    hs_analytics_source: 'analyticsSource',
    hs_analytics_source_data_1: 'analyticsSourceData',
    notes_last_contacted: 'lastContacted',
    notes_last_activity_date: 'lastActivityDate',
    num_contacted_notes: 'numContactedNotes',
    hs_email_domain: 'emailDomain',
    hs_marketable_status: 'marketableStatus',
    hubspot_owner_id: 'hubspotOwnerId',
    associatedcompanyid: 'associatedCompanyId',
    lifecyclestage: 'lifecycleStage',
  }

  for (const [hsKey, camelKey] of Object.entries(mapping)) {
    const val = p[hsKey]
    if (val) extras[camelKey] = val
  }

  return Object.keys(extras).length > 0 ? extras : null
}

// ─── GET: Fetch contacts from HubSpot (read-only preview) ───────────────────

export const GET = withErrorHandler('integrations/hubspot/contacts GET', async (req) => {
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

  const res = await fetch(`${HUBSPOT_CONTACTS_URL}?${params}`, {
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
  const contacts = data.results.map(mapContactToResponse)

  return NextResponse.json({
    contacts,
    nextAfter: data.paging?.next?.after ?? null,
    total: contacts.length,
  })
})

// ─── POST: Import contacts HubSpot → GravHub (one-way sync) ────────────────

export const POST = withErrorHandler('integrations/hubspot/contacts POST', async (req) => {
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

  const { data: existingContacts } = await db.from('crm_contacts').select('emails')
  const existingEmails = new Set<string>()
  for (const c of existingContacts ?? []) {
    for (const e of c.emails ?? []) existingEmails.add(e.toLowerCase())
  }

  // Build company lookup maps for association resolution
  const { data: allCompanies } = await db.from('crm_companies').select('id, name')
  const companyByName = new Map<string, string>()
  for (const co of allCompanies ?? []) {
    companyByName.set(co.name.toLowerCase(), co.id)
  }

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

    const res = await fetch(`${HUBSPOT_CONTACTS_URL}?${params}`, {
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
      const email = s(p.email).toLowerCase().trim()
      const firstName = s(p.firstname)
      const lastName = s(p.lastname)

      if (!firstName && !lastName && !email) {
        skipped++
        continue
      }

      // Build the phones array from phone + mobilephone
      const phones: string[] = []
      if (p.phone) phones.push(p.phone)
      if (p.mobilephone && p.mobilephone !== p.phone) phones.push(p.mobilephone)

      // Extended data for the hubspot_data JSONB column
      const hubspotData = buildHubspotData(p)

      // Last activity: prefer HubSpot's notes_last_activity_date
      const lastActivity = p.notes_last_activity_date || undefined

      // Resolve company_id from company name
      const companyName = s(p.company).trim()
      const resolvedCompanyId = companyName ? companyByName.get(companyName.toLowerCase()) ?? null : null

      if (email && existingEmails.has(email)) {
        // ── Update existing contact ──────────────────────────────────────
        const updatePayload: Record<string, unknown> = {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          full_name: `${firstName} ${lastName}`.trim() || undefined,
          company_name: companyName || undefined,
          company_id: resolvedCompanyId || undefined,
          title: p.jobtitle || undefined,
          phones: phones.length > 0 ? phones : undefined,
          linked_in: p.hs_linkedinbio || undefined,
          website: p.website || undefined,
          lifecycle_stage: normalizeLifecycle(p.lifecyclestage) || undefined,
          lead_status: normalizeLeadStatus(p.hs_lead_status) || undefined,
          last_activity: lastActivity,
        }

        if (hubspotData) updatePayload.hubspot_data = hubspotData

        // Strip undefined values so we don't overwrite with nothing
        const cleanPayload = Object.fromEntries(
          Object.entries(updatePayload).filter(([, v]) => v !== undefined),
        )

        const { error } = await db
          .from('crm_contacts')
          .update(cleanPayload)
          .contains('emails', [email])

        if (error) {
          errors.push(`Update ${firstName} ${lastName} (${email}): ${error.message}`)
        } else {
          updated++
        }
        continue
      }

      // ── Insert new contact ───────────────────────────────────────────
      const insertPayload: Record<string, unknown> = {
        id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        company_id: resolvedCompanyId,
        company_name: companyName || '',
        title: p.jobtitle || null,
        emails: email ? [email] : [],
        phones,
        linked_in: p.hs_linkedinbio || null,
        website: p.website || null,
        lifecycle_stage: normalizeLifecycle(p.lifecyclestage),
        lead_status: normalizeLeadStatus(p.hs_lead_status),
        last_activity: lastActivity || null,
        owner: 'Jonathan Graviss',
        tags: [],
        contact_notes: [],
        contact_tasks: [],
        created_date: new Date().toISOString().split('T')[0],
      }

      if (hubspotData) insertPayload.hubspot_data = hubspotData

      const { error } = await db.from('crm_contacts').insert(insertPayload)

      if (error) {
        errors.push(`Insert ${firstName} ${lastName}: ${error.message}`)
      } else {
        inserted++
        if (email) existingEmails.add(email)
      }
    }

    after = data.paging?.next?.after
    if (!after) break
  }

  return NextResponse.json({ inserted, updated, skipped, errors, totalFetched })
})
