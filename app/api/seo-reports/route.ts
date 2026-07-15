import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { sendSingleReport } from '@/lib/seo-report-sender'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('seo-reports GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { data, error } = await db
    .from('client_integrations')
    .select('id, company_name, company_id, gsc_site_url, ga4_property_id, gbp_location_name, portal_enabled, seo_reports_enabled, seo_report_recipients, last_seo_report_at')
    .order('company_name')

  if (error) {
    throw new Error(error.message || 'Failed to fetch integrations')
  }

  return NextResponse.json(data ?? [])
})

export const POST = withErrorHandler('seo-reports POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { companyName, recipientOverride, preview } = body as {
    companyName: string
    recipientOverride?: string
    preview?: boolean
  }

  if (!companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  const result = await sendSingleReport(companyName, { recipientOverride, preview })
  return NextResponse.json(result)
})

export const PATCH = withErrorHandler('seo-reports PATCH', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { id, seoReportsEnabled, seoReportRecipients } = body as {
    id: string
    seoReportsEnabled?: boolean
    seoReportRecipients?: string[]
  }

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (seoReportsEnabled !== undefined) update.seo_reports_enabled = seoReportsEnabled
  if (seoReportRecipients !== undefined) update.seo_report_recipients = seoReportRecipients

  const { data, error } = await db
    .from('client_integrations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update integration')
  }

  return NextResponse.json(data)
})
