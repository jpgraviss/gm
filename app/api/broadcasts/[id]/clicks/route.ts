import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('broadcasts/[id]/clicks GET', async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('broadcast_link_clicks')
    .select('original_url, email')
    .eq('broadcast_id', id)

  if (error) {
    throw new Error(error.message)
  }

  const urlMap = new Map<string, { totalClicks: number; emails: Set<string> }>()
  for (const row of data ?? []) {
    const url = row.original_url ?? ''
    let entry = urlMap.get(url)
    if (!entry) {
      entry = { totalClicks: 0, emails: new Set() }
      urlMap.set(url, entry)
    }
    entry.totalClicks++
    if (row.email) entry.emails.add(row.email)
  }

  const result = Array.from(urlMap.entries())
    .map(([url, { totalClicks, emails }]) => ({
      url,
      totalClicks,
      uniqueClickers: emails.size,
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks)

  return NextResponse.json(result)
})
