import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { buildClientReport, saveReportSnapshot, type ClientReportConfig } from '@/lib/client-reports'
import { requireRole } from '@/lib/rbac'

/**
 * POST /api/client-reports
 * Builds a client report from the supplied config (company + integrations +
 * date window).
 *
 * Request body:
 * {
 *   companyName: string,
 *   companyId?: string,
 *   gscSiteUrl?: string,
 *   ga4PropertyId?: string,
 *   gbpLocationName?: string,
 *   startDate: string (YYYY-MM-DD),
 *   endDate:   string (YYYY-MM-DD),
 *   save?: boolean
 * }
 */
export const POST = withErrorHandler('client-reports POST', async (req) => {
  // "Read-only" is about not mutating a business record, not about being
  // safe to leave unauthenticated: any caller could otherwise harvest a
  // client's live GSC/GA4/GBP data (and, with save:true, write real rows
  // into client_data_snapshots) by supplying its integration IDs directly.
  // The one real caller (app/reports/client/page.tsx) is staff-only.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as Partial<ClientReportConfig> & { save?: boolean }

  if (!body.companyName || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'companyName, startDate, and endDate are required' },
      { status: 400 },
    )
  }

  const report = await buildClientReport({
    companyName:      body.companyName,
    companyId:        body.companyId,
    gscSiteUrl:       body.gscSiteUrl,
    ga4PropertyId:    body.ga4PropertyId,
    gbpLocationName:  body.gbpLocationName,
    startDate:        body.startDate,
    endDate:          body.endDate,
  })

  if (body.save) {
    await saveReportSnapshot(report)
  }

  return NextResponse.json(report)
})
