import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { mapTracked } from '@/lib/rank-tracker'
import type { TrackedKeyword } from '@/lib/rank-tracker'

export async function GET(req: NextRequest) {
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

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
}
