import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = createServiceClient()

  const { data, error } = await db
    .from('broadcast_link_clicks')
    .select('original_url, email')
    .eq('broadcast_id', id)

  if (error) {
    console.error('[broadcast clicks GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
}
