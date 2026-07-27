import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { mapTracked } from '@/lib/rank-tracker'
import type { TrackedKeyword } from '@/lib/rank-tracker'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

export const GET = withErrorHandler('rank-tracker/export GET', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const db = createServiceClient()
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')
  const tag = searchParams.get('tag')
  const clientId = searchParams.get('clientId')

  let query = db
    .from('tracked_keywords')
    .select('*')
    .order('company_name', { ascending: true })

  if (company) query = query.eq('company_name', company)
  if (clientId) query = query.eq('company_id', clientId)
  if (tag) query = query.contains('tags', [tag])

  // AUDIT — this export had no row cap at all, unlike the sibling
  // app/api/admin/export/route.ts (.limit(10000)), so a large org could
  // silently get a truncated CSV (Supabase's own default row cap) with no
  // indication anything was cut off. Cap explicitly, matching the sibling.
  query = query.limit(10000)

  const { data, error } = await query
  if (error) {
    throw new Error(error?.message || 'Failed to export keywords')
  }

  const rows: TrackedKeyword[] = (data ?? []).map(mapTracked)

  const header = 'Keyword,Current Position,Previous Position,Best Position,Change,Company,Site URL,Target URL,Tags,Search Engine,Location,Country,Last Checked'
  const csvRows = rows.map(r => {
    const change = r.currentPosition != null && r.previousPosition != null
      ? (r.previousPosition - r.currentPosition).toFixed(1)
      : ''
    return [
      `"${r.keyword.replace(/"/g, '""')}"`,
      r.currentPosition ?? '',
      r.previousPosition ?? '',
      r.bestPosition ?? '',
      change,
      `"${r.companyName.replace(/"/g, '""')}"`,
      `"${r.siteUrl}"`,
      `"${r.targetUrl ?? ''}"`,
      `"${r.tags.join(', ')}"`,
      r.searchEngine,
      r.location ?? '',
      r.country,
      r.lastCheckedAt ?? '',
    ].join(',')
  })

  const csv = [header, ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="rank-tracker-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})
