import { describe, it, expect } from 'vitest'
import { validate, PROPOSAL_STATUSES } from '@/lib/validation'

// Schema matching the proposals route POST validation
const proposalSchema = {
  company:     { required: true, type: 'string' as const, maxLength: 200 },
  status:      { type: 'string' as const, enum: [...PROPOSAL_STATUSES] },
  value:       { type: 'number' as const, min: 0, max: 100_000_000 },
  serviceType: { type: 'string' as const, maxLength: 100 },
  assignedRep: { type: 'string' as const, maxLength: 200 },
  items:       { type: 'array' as const },
}

describe('proposals route validation', () => {
  it('accepts valid proposal data with all fields', () => {
    const body = {
      company: 'Acme Corp',
      status: 'Draft',
      value: 25000,
      serviceType: 'SEO',
      assignedRep: 'Jane Doe',
      items: [{ description: 'SEO Audit', amount: 5000 }],
    }
    const result = validate(body, proposalSchema)
    expect(result.valid).toBe(true)
  })

  it('accepts valid proposal with only required fields', () => {
    const body = { company: 'Minimal Inc' }
    const result = validate(body, proposalSchema)
    expect(result.valid).toBe(true)
  })

  it('rejects missing company', () => {
    const body = { status: 'Draft', value: 1000 }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'Missing required field: company' })
  })

  it('rejects null company', () => {
    const body = { company: null, status: 'Draft' }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'Missing required field: company' })
  })

  it('rejects invalid status', () => {
    const body = { company: 'Acme', status: 'Bogus' }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({
      valid: false,
      error: `Invalid value for status: must be one of ${PROPOSAL_STATUSES.join(', ')}`,
    })
  })

  it('accepts all valid proposal statuses', () => {
    for (const status of PROPOSAL_STATUSES) {
      const result = validate({ company: 'Test', status }, proposalSchema)
      expect(result.valid).toBe(true)
    }
  })

  it('rejects negative value', () => {
    const body = { company: 'Acme', value: -1 }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'value must be at least 0' })
  })

  it('rejects value over 100M', () => {
    const body = { company: 'Acme', value: 200_000_000 }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'value must be at most 100000000' })
  })

  it('accepts value of zero', () => {
    const body = { company: 'Acme', value: 0 }
    const result = validate(body, proposalSchema)
    expect(result.valid).toBe(true)
  })

  it('rejects non-array items', () => {
    const body = { company: 'Acme', items: 'not-an-array' }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'Invalid type for items: expected array' })
  })

  it('accepts empty items array', () => {
    const body = { company: 'Acme', items: [] }
    const result = validate(body, proposalSchema)
    expect(result.valid).toBe(true)
  })

  it('rejects company exceeding maxLength', () => {
    const body = { company: 'X'.repeat(201) }
    const result = validate(body, proposalSchema)
    expect(result).toEqual({ valid: false, error: 'company exceeds max length of 200' })
  })
})
