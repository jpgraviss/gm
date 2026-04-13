import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, slicePage, paginatedJson } from '@/lib/pagination'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubmission(row: any) {
  return {
    id:         row.id,
    formId:     row.form_id,
    data:       row.data ?? {},
    sourceUrl:  row.source_url ?? undefined,
    contactId:  row.contact_id ?? undefined,
    status:     row.status,
    createdAt:  row.created_at,
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { limit, cursor } = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('form_submissions')
    .select('*')
    .eq('form_id', id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) {
    console.error('[forms submissions GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { rows, nextCursor } = slicePage(data ?? [], limit, 'created_at')
  return paginatedJson(rows.map(mapSubmission), nextCursor)
}
