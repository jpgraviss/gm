import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { sendSingleReport } from '@/lib/seo-report-sender'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler('seo-reports/[companyId] GET', async (_req, { params }: { params: Promise<{ companyId: string }> }) => {
  const { companyId } = await params
  const db = createServiceClient()

  const { data: snapshots, error } = await db
    .from('client_data_snapshots')
    .select('*')
    .eq('company_id', companyId)
    .order('period_end', { ascending: false })
    .limit(50)

  if (error) {
    throw new Error(error.message || 'Failed to fetch snapshots')
  }

  const grouped: Record<string, Record<string, unknown>> = {}
  for (const snap of (snapshots ?? []) as Array<{ period_start: string; period_end: string; product: string; metrics: Record<string, unknown> }>) {
    const key = `${snap.period_start}_${snap.period_end}`
    if (!grouped[key]) grouped[key] = { periodStart: snap.period_start, periodEnd: snap.period_end }
    grouped[key][snap.product] = snap.metrics
  }

  return NextResponse.json(Object.values(grouped))
})

export const POST = withErrorHandler('seo-reports/[companyId] POST', async (req, { params }: { params: Promise<{ companyId: string }> }) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { companyId } = await params
  const db = createServiceClient()

  const { data: integration } = await db
    .from('client_integrations')
    .select('company_name')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!integration) {
    return NextResponse.json({ error: 'No integration found for this company' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const { recipientOverride, preview } = body as { recipientOverride?: string; preview?: boolean }

  const result = await sendSingleReport(
    (integration as { company_name: string }).company_name,
    { recipientOverride, preview },
  )
  return NextResponse.json(result)
})
