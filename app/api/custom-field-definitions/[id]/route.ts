import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

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

// fieldKey is intentionally not editable here — it's the storage key inside
// every record's custom_fields jsonb bag, so changing it would orphan
// already-saved values. Rename the display label instead; delete + recreate
// if the underlying key really needs to change.
export const PATCH = withErrorHandler('custom-field-definitions/[id] PATCH', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const body = await req.json()
  const result = validate(body, {
    label:     { type: 'string', maxLength: 100 },
    fieldType: { type: 'string', enum: FIELD_TYPES },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const updates: Record<string, unknown> = {}
  if (body.label !== undefined) updates.label = body.label
  if (body.fieldType !== undefined) updates.field_type = body.fieldType
  if (body.options !== undefined) updates.options = Array.isArray(body.options) ? body.options : []
  if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder

  const { data, error } = await db
    .from('custom_field_definitions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapDefinition(data))
})

// Deletes only the definition — existing records keep whatever value is
// already stored under that key in their custom_fields jsonb, it just stops
// rendering anywhere once no definition matches it. Acceptable: cheap,
// reversible (recreate the same field_key to bring the old values back),
// and avoids a bulk UPDATE across every contact/company/deal on every delete.
export const DELETE = withErrorHandler('custom-field-definitions/[id] DELETE', async (req, ctx) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { id } = await ctx!.params
  const db = createServiceClient()
  const { error } = await db.from('custom_field_definitions').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json({ success: true })
})
