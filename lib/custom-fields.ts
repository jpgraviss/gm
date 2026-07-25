import { createServiceClient } from '@/lib/supabase'

// AUDIT — every contact/company/deal write route accepted `customFields` as
// an untyped object with zero validation against the live field
// definitions. The UI enforces type via input controls (number/date/
// checkbox/select), but a direct API call could store arbitrary text into
// a field presented everywhere as numeric/date/select-typed, since storage
// itself is deliberately untyped (see add_custom_fields.sql) and nothing
// validated the VALUE against its DEFINITION before writing.

type CustomFieldEntityType = 'contacts' | 'companies' | 'deals'

interface FieldDefRow {
  field_key: string
  label: string
  field_type: 'text' | 'number' | 'date' | 'boolean' | 'select'
  options: string[]
}

/**
 * Validates a `customFields` object against the live definitions for the
 * given entity type. Returns a human-readable error message if invalid,
 * or null if the object is valid (or empty). Unknown keys (no matching
 * definition — e.g. a since-deleted field) are left alone, matching the
 * existing lenient behavior elsewhere in this codebase.
 */
export async function validateCustomFieldValues(
  entityType: CustomFieldEntityType,
  customFields: unknown,
): Promise<string | null> {
  if (customFields === undefined || customFields === null) return null
  if (typeof customFields !== 'object' || Array.isArray(customFields)) {
    return 'customFields must be an object'
  }
  const entries = Object.entries(customFields as Record<string, unknown>)
  if (entries.length === 0) return null

  const db = createServiceClient()
  const { data: defs } = await db
    .from('custom_field_definitions')
    .select('field_key, label, field_type, options')
    .eq('entity_type', entityType)

  const byKey = new Map((defs ?? []).map((d: FieldDefRow) => [d.field_key, d]))

  for (const [key, rawValue] of entries) {
    const def = byKey.get(key)
    if (!def) continue
    if (rawValue === null || rawValue === undefined || rawValue === '') continue

    switch (def.field_type) {
      case 'number':
        if (typeof rawValue !== 'number' && (typeof rawValue !== 'string' || rawValue.trim() === '' || Number.isNaN(Number(rawValue)))) {
          return `"${def.label}" must be a number`
        }
        break
      case 'date':
        if (typeof rawValue !== 'string' || Number.isNaN(Date.parse(rawValue))) {
          return `"${def.label}" must be a valid date`
        }
        break
      case 'boolean':
        if (typeof rawValue !== 'boolean' && rawValue !== 'true' && rawValue !== 'false') {
          return `"${def.label}" must be true or false`
        }
        break
      case 'select':
        if (typeof rawValue !== 'string' || (def.options.length > 0 && !def.options.includes(rawValue))) {
          return `"${def.label}" must be one of: ${def.options.join(', ')}`
        }
        break
      case 'text':
      default:
        if (typeof rawValue !== 'string') {
          return `"${def.label}" must be text`
        }
        break
    }
  }

  return null
}
