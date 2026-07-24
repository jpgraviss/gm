// Granola (granola.ai) meeting-notes integration. Granola auto-transcribes
// and summarizes meetings; this pulls those notes into GravHub as CRM
// activity, matched to the real contact/company by attendee email — the
// same "meeting shows up on the company timeline automatically" pattern
// HubSpot's own meeting sync gives, without anyone manually logging it.
//
// Unlike AUDIT.md #33 (geolocation), which gates on an env var, Granola's
// API key is workspace-scoped and created per-user from Granola's own
// desktop app (Settings > paste key here, same UX as the existing HubSpot
// integration) — so it's stored in app_settings.granola.apiKey, not an
// env var. Until a key is saved, isGranolaConfigured() is false and sync
// is a no-op: zero network calls, nothing fabricated.
//
// IMPORTANT — Granola's official REST API (public-api.granola.ai) shipped
// in early 2026 and its exact request/response contract could not be
// independently verified against the live docs while building this (the
// docs site blocked automated fetches). The endpoint path, auth header,
// and response field names below are this integration's best-effort
// implementation against the most consistently corroborated third-party
// documentation available. Use "Test Connection" in Settings after adding
// a real API key — if the shape is wrong, that call will surface the
// actual HTTP status/response body rather than silently doing nothing, so
// wiring can be corrected against the real API once you have access.
// Docs: https://docs.granola.ai/help-center/sharing/integrations/granola-api

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encryption'

const GRANOLA_API_BASE = 'https://public-api.granola.ai/v1'

export interface GranolaSettings {
  apiKey?: string
  lastSyncedAt?: string
}

export interface GranolaAttendee {
  name?: string
  email?: string
}

export interface GranolaDocument {
  id: string
  title?: string
  summary_markdown?: string
  attendees?: GranolaAttendee[]
  updated_at?: string
  created_at?: string
}

async function getGranolaSettings(db: SupabaseClient): Promise<GranolaSettings> {
  const { data } = await db
    .from('app_settings')
    .select('granola')
    .eq('id', 'global')
    .maybeSingle()
  const settings = (data?.granola as GranolaSettings) ?? {}
  // apiKey is encrypted at rest (app/api/settings/route.ts PATCH); decrypt()
  // safely no-ops on legacy rows saved before encryption was added.
  return settings.apiKey ? { ...settings, apiKey: decrypt(settings.apiKey) } : settings
}

export async function isGranolaConfigured(db?: SupabaseClient): Promise<boolean> {
  const settings = await getGranolaSettings(db ?? createServiceClient())
  return !!settings.apiKey
}

// Real, single round-trip call — used by both the Settings "Test
// Connection" button and to fail fast/loud (not silently) if sync ever
// starts running against a revoked or malformed key.
export async function testGranolaConnection(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRANOLA_API_BASE}/documents?limit=1`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) return { ok: true }
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Granola responded with ${res.status}: ${text || res.statusText}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to reach Granola' }
  }
}

async function fetchGranolaDocuments(apiKey: string, since?: string): Promise<GranolaDocument[]> {
  const params = new URLSearchParams({ limit: '50' })
  if (since) params.set('updated_after', since)

  const res = await fetch(`${GRANOLA_API_BASE}/documents?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    throw new Error(`Granola API responded with ${res.status}`)
  }
  const data = await res.json()
  // Tolerate either a bare array or a {documents: [...]} / {data: [...]}
  // envelope — the exact response shape wasn't independently verifiable
  // (see file header), and failing to parse a working response is worse
  // than a slightly-defensive parse.
  const docs = Array.isArray(data) ? data : (data.documents ?? data.data ?? [])
  return docs as GranolaDocument[]
}

export interface GranolaSyncResult {
  fetched: number
  imported: number
  matched: number
  skipped: number
  error?: string
}

// Pulls documents updated since the last sync, matches attendees against
// crm_contacts by email, and logs each as a real crm_activities row (type
// 'meeting') so it shows up on the matched contact/company's existing
// Activity timeline — no new UI needed. A document with no email match to
// an existing contact is still recorded in granola_meeting_notes (for
// count/visibility in Settings) but isn't logged as a CRM activity, since
// there's nothing real to attach it to.
export async function syncGranolaNotes(db?: SupabaseClient): Promise<GranolaSyncResult> {
  const supabase = db ?? createServiceClient()
  const settings = await getGranolaSettings(supabase)

  if (!settings.apiKey) {
    return { fetched: 0, imported: 0, matched: 0, skipped: 0, error: 'Granola is not configured' }
  }

  let docs: GranolaDocument[]
  try {
    docs = await fetchGranolaDocuments(settings.apiKey, settings.lastSyncedAt)
  } catch (err) {
    return {
      fetched: 0, imported: 0, matched: 0, skipped: 0,
      error: err instanceof Error ? err.message : 'Failed to fetch Granola documents',
    }
  }

  let imported = 0
  let matched = 0
  let skipped = 0
  let latestSeen = settings.lastSyncedAt ?? ''

  for (const doc of docs) {
    if (!doc.id) continue

    const updatedAt = doc.updated_at ?? doc.created_at ?? new Date().toISOString()
    if (updatedAt > latestSeen) latestSeen = updatedAt

    // Already imported — Granola has no delete-tracking, so re-fetching an
    // already-synced doc inside the updated_after window (e.g. it was
    // edited after being summarized) is expected, not an error; just skip
    // re-inserting it rather than erroring on the unique constraint.
    const { data: existing } = await supabase
      .from('granola_meeting_notes')
      .select('id')
      .eq('granola_document_id', doc.id)
      .maybeSingle()
    if (existing) { skipped++; continue }

    const attendeeEmails = (doc.attendees ?? [])
      .map(a => a.email?.toLowerCase())
      .filter((e): e is string => !!e)

    let contactId: string | null = null
    let companyId: string | null = null
    if (attendeeEmails.length > 0) {
      const { data: contact } = await supabase
        .from('crm_contacts')
        .select('id, company_id')
        .overlaps('emails', attendeeEmails)
        .limit(1)
        .maybeSingle()
      if (contact) {
        contactId = contact.id
        companyId = contact.company_id ?? null
        matched++
      }
    }

    const noteId = `granola-${doc.id}`
    let activityId: string | null = null

    if (contactId) {
      activityId = `act-granola-${doc.id}`
      await supabase.from('crm_activities').insert({
        id: activityId,
        type: 'meeting',
        title: doc.title || 'Meeting (via Granola)',
        body: doc.summary_markdown ?? null,
        company_id: companyId,
        contact_id: contactId,
        user_name: 'Granola',
        timestamp: updatedAt,
      })
    }

    await supabase.from('granola_meeting_notes').insert({
      id: noteId,
      granola_document_id: doc.id,
      title: doc.title || '',
      summary: doc.summary_markdown ?? null,
      attendees: doc.attendees ?? [],
      occurred_at: updatedAt,
      company_id: companyId,
      contact_id: contactId,
      activity_id: activityId,
    })
    imported++
  }

  // `settings` here holds the decrypted apiKey (from getGranolaSettings) —
  // re-encrypt it before writing back so this sync bookkeeping update
  // doesn't undo at-rest encryption on every tick.
  await supabase
    .from('app_settings')
    .update({
      granola: {
        ...settings,
        apiKey: settings.apiKey ? encrypt(settings.apiKey) : settings.apiKey,
        lastSyncedAt: latestSeen || new Date().toISOString(),
      },
    })
    .eq('id', 'global')

  return { fetched: docs.length, imported, matched, skipped }
}
