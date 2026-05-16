import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts'
const PROPERTIES = ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'hs_lead_status']
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

interface HubSpotContact {
  id: string
  properties: Record<string, string | null>
}

interface HubSpotResponse {
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

export async function GET(req: NextRequest) {
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
  const contacts = data.results.map(c => ({
    hubspotId: c.id,
    firstName: c.properties.firstname ?? '',
    lastName: c.properties.lastname ?? '',
    email: c.properties.email ?? '',
    phone: c.properties.phone ?? '',
    companyName: c.properties.company ?? '',
    title: c.properties.jobtitle ?? '',
    leadStatus: c.properties.hs_lead_status ?? '',
  }))

  return NextResponse.json({
    contacts,
    nextAfter: data.paging?.next?.after ?? null,
    total: contacts.length,
  })
}

function normalizeLifecycle(val?: string): string | null {
  if (!val) return null
  const v = val.toLowerCase()
  if (v.includes('lead') || v.includes('new') || v.includes('subscriber')) return 'lead'
  if (v.includes('opport') || v.includes('qualified') || v.includes('open')) return 'opportunity'
  if (v.includes('client') || v.includes('customer') || v.includes('won')) return 'client'
  return 'other'
}

export async function POST(req: NextRequest) {
  const apiKey = await getApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HubSpot API key not configured. Add it in Settings > Integrations.' },
      { status: 400 },
    )
  }

  const body = await req.json() as { selectedIds?: string[] }
  const selectedIds = body.selectedIds ? new Set(body.selectedIds) : null

  const db = createServiceClient()

  const { data: existingContacts } = await db.from('crm_contacts').select('emails')
  const existingEmails = new Set<string>()
  for (const c of existingContacts ?? []) {
    for (const e of (c.emails ?? [])) existingEmails.add(e.toLowerCase())
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

      const email = (c.properties.email ?? '').toLowerCase().trim()
      const firstName = c.properties.firstname ?? ''
      const lastName = c.properties.lastname ?? ''

      if (!firstName && !lastName && !email) {
        skipped++
        continue
      }

      if (email && existingEmails.has(email)) {
        const { error } = await db
          .from('crm_contacts')
          .update({
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            full_name: `${firstName} ${lastName}`.trim() || undefined,
            company_name: c.properties.company || undefined,
            title: c.properties.jobtitle || undefined,
            phones: c.properties.phone ? [c.properties.phone] : undefined,
            lead_status: normalizeLifecycle(c.properties.hs_lead_status ?? undefined) || undefined,
          })
          .contains('emails', [email])

        if (error) {
          errors.push(`Update ${firstName} ${lastName} (${email}): ${error.message}`)
        } else {
          updated++
        }
        continue
      }

      const { error } = await db.from('crm_contacts').insert({
        id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        company_name: c.properties.company ?? '',
        title: c.properties.jobtitle || null,
        emails: email ? [email] : [],
        phones: c.properties.phone ? [c.properties.phone] : [],
        lifecycle_stage: normalizeLifecycle(c.properties.hs_lead_status ?? undefined),
        owner: 'Jonathan Graviss',
        tags: [],
        contact_notes: [],
        contact_tasks: [],
        created_date: new Date().toISOString().split('T')[0],
      })

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
}
