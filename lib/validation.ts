import { NextResponse } from 'next/server'

type FieldRule = {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object'
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: string[]
}

type Schema = Record<string, FieldRule>

type ValidationResult =
  | { valid: true; data: Record<string, unknown> }
  | { valid: false; error: string }

export function validate(body: Record<string, unknown>, schema: Schema): ValidationResult {
  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field]

    if (rules.required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: `Missing required field: ${field}` }
    }

    if (value === undefined || value === null) continue

    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== rules.type) {
        return { valid: false, error: `Invalid type for ${field}: expected ${rules.type}` }
      }
    }

    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      return { valid: false, error: `${field} exceeds max length of ${rules.maxLength}` }
    }

    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      return { valid: false, error: `${field} must be at least ${rules.min}` }
    }

    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      return { valid: false, error: `${field} must be at most ${rules.max}` }
    }

    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return { valid: false, error: `Invalid format for ${field}` }
    }

    if (rules.enum && typeof value === 'string' && !rules.enum.includes(value)) {
      return { valid: false, error: `Invalid value for ${field}: must be one of ${rules.enum.join(', ')}` }
    }
  }

  return { valid: true, data: body }
}

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const SLUG_PATTERN = /^[a-z0-9-]+$/

export const DEAL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] as const
export const PROPOSAL_STATUSES = ['Draft', 'Submitted for Approval', 'Approved', 'Sent', 'Viewed', 'Accepted', 'Declined'] as const
export const CONTRACT_STATUSES = ['Draft', 'Pending Signature', 'Partially Executed', 'Fully Executed', 'Expired', 'Terminated'] as const
export const INVOICE_STATUSES = ['Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'] as const
export const PROJECT_STATUSES = ['Not Started', 'In Progress', 'In Review', 'Completed', 'Launched', 'In Maintenance', 'On Hold'] as const
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const
export const TICKET_STATUSES = ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'] as const
