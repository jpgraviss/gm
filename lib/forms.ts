/**
 * Lead form field types + helpers.
 */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'multi_select'
  | 'radio'
  | 'number'
  | 'url'
  | 'hidden'
  | 'date'
  | 'rating'
  | 'signature'
  | 'page_break'

export interface FieldCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty'
  value?: string
}

export interface FormField {
  id: string
  type: FormFieldType
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  helpText?: string
  mapsTo?: 'first_name' | 'last_name' | 'email' | 'phone' | 'company' | 'notes' | 'custom'
  ratingMax?: number
  conditions?: FieldCondition[]
}

export interface Form {
  id: string
  workspaceId?: string
  name: string
  slug: string
  description?: string
  fields: FormField[]
  submitLabel: string
  successMessage: string
  redirectUrl?: string
  notifyEmails: string[]
  createContact: boolean
  createDeal: boolean
  dealStage?: string
  tags: string[]
  owner?: string
  status: 'Active' | 'Paused' | 'Draft'
  submissionsCount: number
  primaryColor: string
  textColor: string
  bgColor: string
  bgTransparent: boolean
  fontFamily: string
  webhookUrl?: string
  sendConfirmation: boolean
  confirmationSubject?: string
  confirmationMessage?: string
  createdAt: string
  updatedAt: string
}

export interface FormSubmission {
  id: string
  formId: string
  data: Record<string, string | number | boolean>
  sourceUrl?: string
  contactId?: string
  status: 'new' | 'contacted' | 'archived'
  createdAt: string
}

/**
 * Generate a URL-safe slug from a form name. Used as the public form URL.
 */
export function slugifyForm(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

/**
 * Validate a form submission against the form schema.
 * Returns null if valid, else an error message.
 */
export function evaluateConditions(
  conditions: FieldCondition[] | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(c => {
    const val = String(data[c.field] ?? '')
    switch (c.operator) {
      case 'equals':       return val === (c.value ?? '')
      case 'not_equals':   return val !== (c.value ?? '')
      case 'contains':     return val.includes(c.value ?? '')
      case 'is_empty':     return !val
      case 'is_not_empty': return !!val
      default:             return true
    }
  })
}

export function validateSubmission(
  form: Pick<Form, 'fields'>,
  data: Record<string, unknown>,
): string | null {
  for (const field of form.fields) {
    if (field.type === 'page_break') continue
    if (!evaluateConditions(field.conditions, data)) continue
    const value = data[field.name]
    if (field.required && (value === undefined || value === null || value === '')) {
      return `Field "${field.label}" is required`
    }
    if (field.type === 'email' && value) {
      const str = String(value)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        return `Field "${field.label}" must be a valid email`
      }
    }
    if (field.type === 'phone' && value) {
      const digits = String(value).replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) {
        return `Field "${field.label}" must be a valid phone number (7-15 digits)`
      }
    }
    if (field.type === 'url' && value) {
      try {
        new URL(String(value))
      } catch {
        return `Field "${field.label}" must be a valid URL`
      }
    }
    if (field.type === 'number' && value !== undefined && value !== '') {
      if (Number.isNaN(Number(value))) {
        return `Field "${field.label}" must be a number`
      }
    }
    if (field.type === 'date' && value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return `Field "${field.label}" must be a valid date`
      }
    }
    if (field.type === 'rating' && value !== undefined && value !== '') {
      const n = Number(value)
      if (Number.isNaN(n) || n < 1 || n > (field.ratingMax ?? 5)) {
        return `Field "${field.label}" must be a rating between 1 and ${field.ratingMax ?? 5}`
      }
    }
    if (field.type === 'signature' && field.required && !value) {
      return `Field "${field.label}" requires a signature`
    }
  }
  return null
}

/**
 * Map form submission data → CRM contact fields.
 * Uses the mapsTo metadata on each field to build the contact row.
 */
export function submissionToContact(
  form: Pick<Form, 'fields'>,
  data: Record<string, unknown>,
): {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  notes: string
} {
  const out = { firstName: '', lastName: '', email: '', phone: '', company: '', notes: '' }
  const extras: string[] = []

  for (const field of form.fields) {
    const raw = data[field.name]
    if (raw === undefined || raw === null || raw === '') continue
    const value = String(raw)

    switch (field.mapsTo) {
      case 'first_name':
        out.firstName = value
        break
      case 'last_name':
        out.lastName = value
        break
      case 'email':
        out.email = value
        break
      case 'phone':
        out.phone = value
        break
      case 'company':
        out.company = value
        break
      case 'notes':
        out.notes = value
        break
      default:
        // Unmapped fields get appended to notes so they aren't lost
        extras.push(`${field.label}: ${value}`)
    }
  }

  if (extras.length > 0) {
    out.notes = [out.notes, ...extras].filter(Boolean).join('\n')
  }
  return out
}
