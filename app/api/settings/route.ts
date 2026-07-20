import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { validationError } from '@/lib/validation'
import { requireAdmin } from '@/lib/admin-auth'
import { getAuthUser } from '@/lib/rbac'

const SETTINGS_ID = 'global'

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
  return NextResponse.json(data ?? {}, {
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
  if (body.hubspot              !== undefined) updates.hubspot              = body.hubspot
  if (body.resend               !== undefined) updates.resend               = body.resend
  if (body.google_reviews       !== undefined) updates.google_reviews       = body.google_reviews
  if (body.onboarding_completed !== undefined) updates.onboarding_completed = body.onboarding_completed
  if (body.approval_config      !== undefined) updates.approval_config      = body.approval_config
  if (body.gsc_site_url         !== undefined) updates.gsc_site_url         = body.gsc_site_url
  if (body.gsc_last_sync        !== undefined) updates.gsc_last_sync        = body.gsc_last_sync
  if (body.mercury              !== undefined) updates.mercury              = body.mercury
  if (body.maverick             !== undefined) updates.maverick             = body.maverick
  if (body.apollo               !== undefined) updates.apollo               = body.apollo
  if (body.trainingModules      !== undefined) updates.training_modules     = body.trainingModules
  if (body.sops                 !== undefined) updates.sops                 = body.sops
  if (body.security             !== undefined) updates.security             = body.security
  if (body.wordpress            !== undefined) updates.wordpress            = body.wordpress
  if (body.granola              !== undefined) updates.granola              = body.granola
  if (body.stripe               !== undefined) updates.stripe               = body.stripe

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
