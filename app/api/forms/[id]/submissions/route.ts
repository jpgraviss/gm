import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'

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

export const GET = withErrorHandler('forms/[id]/submissions GET', async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const pag = parsePagination(req)
  const db = createServiceClient()

  let query = db
    .from('form_submissions')
    .select('*')
    .eq('form_id', id)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(String(error))
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapSubmission), nextCursor)
})
