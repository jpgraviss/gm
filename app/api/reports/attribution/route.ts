import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

interface AttributionBucket {
  source: string
  medium: string
  campaign: string
  contacts: number
  deals: number
  wonDeals: number
  wonRevenue: number
  pipelineValue: number
}

function bucketKey(source: string, medium: string | null, campaign: string | null) {
  return `${source}::${medium ?? ''}::${campaign ?? ''}`
}

function newBucket(source: string, medium: string | null, campaign: string | null): AttributionBucket {
  return {
    source,
    medium: medium || '(none)',
    campaign: campaign || '(none)',
    contacts: 0,
    deals: 0,
    wonDeals: 0,
    wonRevenue: 0,
    pipelineValue: 0,
  }
}

/**
 * Attribution isn't stored on deals directly — it's captured once, at
 * first touch, on crm_contacts (see add_lead_attribution.sql) and deals
 * join through contact_id to reach it. A deal with no contact_id (manual
 * creation, HubSpot import, or an automation-created deal predating the
 * Create Deal contact_id fix) has no way to reach a source and is honestly
 * reported as unattributed rather than guessed at.
 */
export const GET = withErrorHandler('reports/attribution GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()

  // Capped at 5000 (not the implicit 1000-row Supabase default) — this
  // route aggregates every deal for a report, not a paginated list.
  const { data: deals } = await db
    .from('deals')
    .select('id, stage, value, contact_id')
    .limit(5000)

  const contactIds = Array.from(new Set((deals ?? []).map(d => d.contact_id).filter(Boolean))) as string[]

  const contactMap = new Map<string, { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }>()
  if (contactIds.length > 0) {
    const { data: contacts } = await db
      .from('crm_contacts')
      .select('id, utm_source, utm_medium, utm_campaign')
      .in('id', contactIds)
    for (const c of contacts ?? []) {
      contactMap.set(c.id, { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign })
    }
  }

  const buckets = new Map<string, AttributionBucket>()
  let unattributedDeals = 0
  let unattributedWonRevenue = 0
  let unattributedPipelineValue = 0

  for (const deal of (deals ?? [])) {
    const c = deal.contact_id ? contactMap.get(deal.contact_id) : null
    const isWon = deal.stage === 'Closed Won'
    // startsWith('Closed'), not an exact 'Closed Lost' match, so a custom
    // closed stage (e.g. "Closed — Duplicate") isn't miscounted as pipeline
    // (same bug class as AUDIT #53/#105/#139/#218)
    const isClosed = deal.stage.startsWith('Closed')
    const value = deal.value ?? 0

    if (!c?.utm_source) {
      unattributedDeals++
      if (isWon) unattributedWonRevenue += value
      else if (!isClosed) unattributedPipelineValue += value
      continue
    }

    const key = bucketKey(c.utm_source, c.utm_medium, c.utm_campaign)
    if (!buckets.has(key)) buckets.set(key, newBucket(c.utm_source, c.utm_medium, c.utm_campaign))
    const bucket = buckets.get(key)!
    bucket.deals++
    if (isWon) {
      bucket.wonDeals++
      bucket.wonRevenue += value
    } else if (!isClosed) {
      bucket.pipelineValue += value
    }
  }

  // Contact counts per bucket, independent of whether a contact has ever
  // produced a deal — shows real top-of-funnel volume per channel, not just
  // the subset that converted.
  const { data: attributedContacts } = await db
    .from('crm_contacts')
    .select('utm_source, utm_medium, utm_campaign')
    .not('utm_source', 'is', null)
    .limit(5000)
  for (const c of (attributedContacts ?? [])) {
    const key = bucketKey(c.utm_source as string, c.utm_medium, c.utm_campaign)
    if (!buckets.has(key)) buckets.set(key, newBucket(c.utm_source as string, c.utm_medium, c.utm_campaign))
    buckets.get(key)!.contacts++
  }

  const { count: totalContacts } = await db.from('crm_contacts').select('id', { count: 'exact', head: true })
  const { count: sourcedContacts } = await db
    .from('crm_contacts')
    .select('id', { count: 'exact', head: true })
    .not('utm_source', 'is', null)

  const results = Array.from(buckets.values()).sort(
    (a, b) => b.wonRevenue - a.wonRevenue || b.pipelineValue - a.pipelineValue || b.contacts - a.contacts,
  )

  return NextResponse.json({
    buckets: results,
    unattributed: {
      deals: unattributedDeals,
      wonRevenue: unattributedWonRevenue,
      pipelineValue: unattributedPipelineValue,
    },
    coverage: {
      totalContacts: totalContacts ?? 0,
      sourcedContacts: sourcedContacts ?? 0,
    },
  })
})
