import { NextRequest, NextResponse } from 'next/server'
import { buildClientReport, saveReportSnapshot, type ClientReportConfig } from '@/lib/client-reports'

/**
 * POST /api/client-reports
 * Builds a client report from the supplied config (company + integrations +
 * date window). Does NOT require role elevation since it's read-only.
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
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<ClientReportConfig> & { save?: boolean }

  if (!body.companyName || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'companyName, startDate, and endDate are required' },
      { status: 400 },
    )
  }

  try {
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
  } catch (err) {
    console.error('[client-reports POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build report' },
      { status: 500 },
    )
  }
}
