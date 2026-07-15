import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

const ENTITY_TYPES = ['contacts', 'companies', 'deals']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSavedFilter(row: any) {
  return {
    id:         row.id,
    name:       row.name,
    entityType: row.entity_type,
    criteria:   row.criteria ?? {},
    createdBy:  row.created_by ?? undefined,
    createdDate: row.created_date,
  }
}

export const GET = withErrorHandler('saved-filters GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')

  const db = createServiceClient()
  let query = db.from('saved_filters').select('*').order('created_date', { ascending: false })
  if (entityType) query = query.eq('entity_type', entityType)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json((data ?? []).map(mapSavedFilter))
})

export const POST = withErrorHandler('saved-filters POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    name:       { required: true, type: 'string', maxLength: 200 },
    entityType: { required: true, type: 'string', enum: ENTITY_TYPES },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const { data, error } = await db
    .from('saved_filters')
    .insert({
      id:           `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:         body.name,
      entity_type:  body.entityType,
      criteria:     body.criteria ?? {},
      created_by:   body.createdBy ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapSavedFilter(data), { status: 201 })
})
