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
  | 'radio'
  | 'number'
  | 'url'
  | 'hidden'

export interface FormField {
  id: string
  type: FormFieldType
  name: string            // form field key, e.g. "first_name"
  label: string           // visible label
  placeholder?: string
  required?: boolean
  options?: string[]      // for select/radio/checkbox
  defaultValue?: string
  helpText?: string
  mapsTo?: 'first_name' | 'last_name' | 'email' | 'phone' | 'company' | 'notes' | 'custom'
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
export function validateSubmission(
  form: Pick<Form, 'fields'>,
  data: Record<string, unknown>,
): string | null {
  for (const field of form.fields) {
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
