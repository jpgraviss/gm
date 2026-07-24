import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validationError } from '@/lib/validation'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'
import { encrypt, decrypt } from '@/lib/encryption'

const SETTINGS_ID = 'global'

// Third-party API-key/secret integrations whose credentials are encrypted
// at rest (same AES-256-GCM pattern lib/encryption.ts already applies to
// the OAuth-based integrations' tokens). Keyed by app_settings column name
// -> the string fields inside that column's JSON value that hold secrets.
const ENCRYPTED_INTEGRATION_FIELDS: Record<string, string[]> = {
  hubspot: ['apiKey'],
  mercury: ['apiKey'],
  maverick: ['apiKey'],
  apollo: ['apiKey'],
  granola: ['apiKey'],
  stripe: ['secretKey', 'webhookSecret'],
  resend: ['apiKey'],
}

function transformSecretFields(
  value: unknown,
  fields: string[],
  transform: (raw: string) => string,
): unknown {
  if (!value || typeof value !== 'object') return value
  const obj: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const field of fields) {
    const raw = obj[field]
    if (typeof raw === 'string' && raw) {
      obj[field] = transform(raw)
    }
  }
  return obj
}

export const GET = withErrorHandler('settings GET', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle()
  if (error) {
    throw new Error(error?.message || 'Failed to fetch settings')
  }
  // Admin-only, but never cache a response carrying plaintext API keys.
  // The settings UI populates its "current key" inputs straight from this
  // response (see app/settings/page.tsx), so these fields are decrypted
  // back to plaintext here — decrypt() safely no-ops on legacy rows that
  // were stored unencrypted before this fix.
  const responseData: Record<string, unknown> = { ...(data ?? {}) }
  for (const [column, fields] of Object.entries(ENCRYPTED_INTEGRATION_FIELDS)) {
    if (responseData[column] !== undefined) {
      responseData[column] = transformSecretFields(responseData[column], fields, decrypt)
    }
  }
  return NextResponse.json(responseData, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
})

export const PATCH = withErrorHandler('settings PATCH', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const actor = await getAuthUser(req)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const db = createServiceClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.company          !== undefined) updates.company          = body.company
  if (body.notifications    !== undefined) updates.notifications    = body.notifications
  if (body.invoiceDefaults  !== undefined) updates.invoice_defaults = body.invoiceDefaults
  if (body.pipelineStages   !== undefined) updates.pipeline_stages  = body.pipelineStages
  if (body.serviceTypes     !== undefined) updates.service_types    = body.serviceTypes
  if (body.contactTags      !== undefined) updates.contact_tags     = body.contactTags
  if (body.branding         !== undefined) updates.branding         = body.branding
  if (body.gcalLinks        !== undefined) updates.gcal_links       = body.gcalLinks
  if (body.pipelines        !== undefined) updates.pipelines        = body.pipelines
  if (body.emailDefaults    !== undefined) updates.email_defaults   = body.emailDefaults
  if (body.dashboardConfig  !== undefined) updates.dashboard_config = body.dashboardConfig
  if (body.engagement       !== undefined) updates.engagement       = body.engagement
  if (body.navigationConfig !== undefined) updates.navigation_config = body.navigationConfig
  if (body.notification_preferences !== undefined) updates.notification_preferences = body.notification_preferences
  if (body.emailTemplates       !== undefined) updates.email_templates      = body.emailTemplates
  // These 7 integrations carry API keys/secrets (Stripe secret key, Mercury
  // bank-API key, HubSpot CRM token, etc.) — encrypt before they ever touch
  // the app_settings JSONB column, matching how the OAuth integrations
  // (Google Marketing, Meta, LinkedIn) encrypt tokens via lib/encryption.ts.
  if (body.hubspot               !== undefined) updates.hubspot  = transformSecretFields(body.hubspot, ENCRYPTED_INTEGRATION_FIELDS.hubspot, encrypt)
  if (body.resend                !== undefined) updates.resend   = transformSecretFields(body.resend, ENCRYPTED_INTEGRATION_FIELDS.resend, encrypt)
  if (body.google_reviews       !== undefined) updates.google_reviews       = body.google_reviews
  if (body.onboarding_completed !== undefined) updates.onboarding_completed = body.onboarding_completed
  if (body.approval_config      !== undefined) updates.approval_config      = body.approval_config
  if (body.gsc_site_url         !== undefined) updates.gsc_site_url         = body.gsc_site_url
  if (body.gsc_last_sync        !== undefined) updates.gsc_last_sync        = body.gsc_last_sync
  if (body.mercury               !== undefined) updates.mercury  = transformSecretFields(body.mercury, ENCRYPTED_INTEGRATION_FIELDS.mercury, encrypt)
  if (body.maverick              !== undefined) updates.maverick = transformSecretFields(body.maverick, ENCRYPTED_INTEGRATION_FIELDS.maverick, encrypt)
  if (body.apollo                !== undefined) updates.apollo   = transformSecretFields(body.apollo, ENCRYPTED_INTEGRATION_FIELDS.apollo, encrypt)
  if (body.trainingModules      !== undefined) updates.training_modules     = body.trainingModules
  if (body.sops                 !== undefined) updates.sops                 = body.sops
  if (body.security             !== undefined) updates.security             = body.security
  if (body.wordpress            !== undefined) updates.wordpress            = body.wordpress
  if (body.granola               !== undefined) updates.granola = transformSecretFields(body.granola, ENCRYPTED_INTEGRATION_FIELDS.granola, encrypt)
  if (body.stripe                !== undefined) updates.stripe  = transformSecretFields(body.stripe, ENCRYPTED_INTEGRATION_FIELDS.stripe, encrypt)

  const { data, error } = await db
    .from('app_settings')
    .upsert({ id: SETTINGS_ID, ...updates }, { onConflict: 'id' })
    .select()
    .single()
  if (error) {
    throw new Error(error?.message || 'Failed to update settings')
  }
  logAudit({ userName: actor?.name || actor?.email || 'system', action: 'updated_settings', module: 'settings', type: 'action' })
  return NextResponse.json(data)
})
