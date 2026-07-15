import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

const ENTITY_TYPES = ['contacts', 'companies', 'deals']
const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDefinition(row: any) {
  return {
    id:          row.id,
    entityType:  row.entity_type,
    fieldKey:    row.field_key,
    label:       row.label,
    fieldType:   row.field_type,
    options:     row.options ?? [],
    sortOrder:   row.sort_order ?? 0,
    createdDate: row.created_date,
  }
}

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
}

export const GET = withErrorHandler('custom-field-definitions GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')

  const db = createServiceClient()
  let query = db.from('custom_field_definitions').select('*').order('sort_order').order('created_date')
  if (entityType) query = query.eq('entity_type', entityType)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json((data ?? []).map(mapDefinition))
})

export const POST = withErrorHandler('custom-field-definitions POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    label:      { required: true, type: 'string', maxLength: 100 },
    entityType: { required: true, type: 'string', enum: ENTITY_TYPES },
    fieldType:  { type: 'string', enum: FIELD_TYPES },
  })
  if (!result.valid) return validationError(result.error)

  const fieldKey = slugify(body.label)
  if (!fieldKey) return NextResponse.json({ error: 'Label must contain at least one letter or number' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('custom_field_definitions')
    .insert({
      id:          `cfd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      entity_type: body.entityType,
      field_key:   fieldKey,
      label:       body.label,
      field_type:  body.fieldType ?? 'text',
      options:     Array.isArray(body.options) ? body.options : [],
      sort_order:  body.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A field named "${body.label}" already exists for this record type` }, { status: 409 })
    }
    throw new Error(error.message)
  }
  return NextResponse.json(mapDefinition(data), { status: 201 })
})
