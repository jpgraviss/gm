import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parsePagination, applyCursor, slicePage, paginatedJson } from '@/lib/pagination'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBrandKit(row: any) {
  return {
    id:             row.id,
    companyId:      row.company_id ?? undefined,
    companyName:    row.company_name,
    logoUrl:        row.logo_url ?? undefined,
    primaryColor:   row.primary_color ?? undefined,
    secondaryColor: row.secondary_color ?? undefined,
    fonts:          row.fonts ?? [],
    toneOfVoice:    row.tone_of_voice ?? undefined,
    hashtags:       row.hashtags ?? [],
    notes:          row.notes ?? undefined,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

export const GET = withErrorHandler('brand-kits GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const pag = parsePagination(req)
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  const db = createServiceClient()
  let query = db
    .from('brand_kits')
    .select('*')
  if (company) query = query.eq('company_name', company)
  query = applyCursor(query, pag)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  const { rows, nextCursor } = slicePage(data ?? [], pag.limit, 'created_at')
  return paginatedJson(rows.map(mapBrandKit), nextCursor)
})

export const POST = withErrorHandler('brand-kits POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  if (!body.companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Upsert by company_name — update if the brand kit already exists for this company
  const { data, error } = await db
    .from('brand_kits')
    .upsert(
      {
        id:              `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company_name:    body.companyName,
        logo_url:        body.logoUrl ?? null,
        primary_color:   body.primaryColor ?? null,
        secondary_color: body.secondaryColor ?? null,
        fonts:           body.fonts ?? [],
        tone_of_voice:   body.toneOfVoice ?? null,
        hashtags:        body.hashtags ?? [],
        notes:           body.notes ?? null,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'workspace_id,company_name' },
    )
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapBrandKit(data), { status: 201 })
})
