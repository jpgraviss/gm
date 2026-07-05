import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { sendSingleReport } from '@/lib/seo-report-sender'

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('client_integrations')
    .select('id, company_name, company_id, gsc_site_url, ga4_property_id, gbp_location_name, portal_enabled, seo_reports_enabled, seo_report_recipients, last_seo_report_at')
    .order('company_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
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

  try {
    const result = await sendSingleReport(companyName, { recipientOverride, preview })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[seo-reports POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to generate report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
