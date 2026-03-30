import { describe, it, expect } from 'vitest'
import { validate, DEAL_STAGES } from '@/lib/validation'

// Schema matching the deals route POST validation
const dealSchema = {
  company:     { required: true, type: 'string' as const, maxLength: 200 },
  stage:       { type: 'string' as const, enum: [...DEAL_STAGES] },
  value:       { type: 'number' as const, min: 0, max: 100_000_000 },
  serviceType: { type: 'string' as const, maxLength: 100 },
  assignedRep: { type: 'string' as const, maxLength: 200 },
  probability: { type: 'number' as const, min: 0, max: 100 },
}

describe('deals route validation', () => {
  it('accepts valid deal data with all fields', () => {
    const body = {
      company: 'Acme Corp',
      stage: 'Proposal',
      value: 75000,
      serviceType: 'Web Development',
      assignedRep: 'Jonathan Graviss',
      probability: 60,
    }
    const result = validate(body, dealSchema)
    expect(result.valid).toBe(true)
  })

  it('accepts valid deal data with only required fields', () => {
    const body = { company: 'Minimal Corp' }
    const result = validate(body, dealSchema)
    expect(result.valid).toBe(true)
  })

  it('rejects missing company', () => {
    const body = { stage: 'Lead', value: 1000 }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'Missing required field: company' })
  })

  it('rejects empty company string', () => {
    const body = { company: '' }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'Missing required field: company' })
  })

  it('rejects invalid stage', () => {
    const body = { company: 'Acme', stage: 'InvalidStage' }
    const result = validate(body, dealSchema)
    expect(result).toEqual({
      valid: false,
      error: `Invalid value for stage: must be one of ${DEAL_STAGES.join(', ')}`,
    })
  })

  it('accepts all valid deal stages', () => {
    for (const stage of DEAL_STAGES) {
      const result = validate({ company: 'Test', stage }, dealSchema)
      expect(result.valid).toBe(true)
    }
  })

  it('rejects negative value', () => {
    const body = { company: 'Acme', value: -500 }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'value must be at least 0' })
  })

  it('rejects value over 100M', () => {
    const body = { company: 'Acme', value: 100_000_001 }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'value must be at most 100000000' })
  })

  it('accepts value at exactly 100M boundary', () => {
    const body = { company: 'Acme', value: 100_000_000 }
    const result = validate(body, dealSchema)
    expect(result.valid).toBe(true)
  })

  it('accepts value of zero', () => {
    const body = { company: 'Acme', value: 0 }
    const result = validate(body, dealSchema)
    expect(result.valid).toBe(true)
  })

  it('rejects probability over 100', () => {
    const body = { company: 'Acme', probability: 101 }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'probability must be at most 100' })
  })

  it('rejects company exceeding maxLength', () => {
    const body = { company: 'A'.repeat(201) }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'company exceeds max length of 200' })
  })

  it('rejects non-string value for stage', () => {
    const body = { company: 'Acme', stage: 123 }
    const result = validate(body, dealSchema)
    expect(result).toEqual({ valid: false, error: 'Invalid type for stage: expected string' })
  })
})
