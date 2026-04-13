import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { checkSite, recordCheck, computeUptime30d } from '@/lib/uptime'

/**
 * POST /api/monitored-sites/:id/check — manually trigger a check for a
 * single site. Returns the check result.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()

  const { data: site, error } = await db
    .from('monitored_sites')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !site) {
    return NextResponse.json({ error: 'Monitored site not found' }, { status: 404 })
  }

  const result = await checkSite(site.url)
  await recordCheck(id, result)

  // Refresh 30d uptime after the new check is recorded
  const uptime30d = await computeUptime30d(id)

  return NextResponse.json({ ...result, uptime30d })
}
