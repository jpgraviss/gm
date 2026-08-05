import { describe, it, expect } from 'vitest'
import { validate, parseNullableNumber } from '@/lib/validation'

describe('validate', () => {
  describe('required field validation', () => {
    it('rejects undefined required fields', () => {
      const result = validate({}, { name: { required: true } })
      expect(result).toEqual({ valid: false, error: 'Missing required field: name' })
    })

    it('rejects null required fields', () => {
      const result = validate({ name: null }, { name: { required: true } })
      expect(result).toEqual({ valid: false, error: 'Missing required field: name' })
    })

    it('rejects empty string required fields', () => {
      const result = validate({ name: '' }, { name: { required: true } })
      expect(result).toEqual({ valid: false, error: 'Missing required field: name' })
    })

    it('allows missing optional fields', () => {
      const result = validate({}, { name: { type: 'string' } })
      expect(result).toEqual({ valid: true, data: {} })
    })
  })

  describe('type checking', () => {
    it('validates string type', () => {
      const result = validate({ name: 123 }, { name: { type: 'string' } })
      expect(result).toEqual({ valid: false, error: 'Invalid type for name: expected string' })
    })

    it('validates number type', () => {
      const result = validate({ count: 'abc' }, { count: { type: 'number' } })
      expect(result).toEqual({ valid: false, error: 'Invalid type for count: expected number' })
    })

    it('validates boolean type', () => {
      const result = validate({ active: 'yes' }, { active: { type: 'boolean' } })
      expect(result).toEqual({ valid: false, error: 'Invalid type for active: expected boolean' })
    })

    it('validates array type', () => {
      const result = validate({ items: 'not-array' }, { items: { type: 'array' } })
      expect(result).toEqual({ valid: false, error: 'Invalid type for items: expected array' })
    })

    it('distinguishes arrays from objects', () => {
      const result = validate({ items: [1, 2, 3] }, { items: { type: 'array' } })
      expect(result).toEqual({ valid: true, data: { items: [1, 2, 3] } })
    })
  })

  describe('maxLength constraint', () => {
    it('rejects strings exceeding maxLength', () => {
      const result = validate({ name: 'abcdef' }, { name: { maxLength: 5 } })
      expect(result).toEqual({ valid: false, error: 'name exceeds max length of 5' })
    })

    it('allows strings within maxLength', () => {
      const result = validate({ name: 'abc' }, { name: { maxLength: 5 } })
      expect(result).toEqual({ valid: true, data: { name: 'abc' } })
    })
  })

  describe('min/max constraints', () => {
    it('rejects numbers below min', () => {
      const result = validate({ age: 5 }, { age: { min: 10 } })
      expect(result).toEqual({ valid: false, error: 'age must be at least 10' })
    })

    it('rejects numbers above max', () => {
      const result = validate({ age: 200 }, { age: { max: 150 } })
      expect(result).toEqual({ valid: false, error: 'age must be at most 150' })
    })

    it('allows numbers within range', () => {
      const result = validate({ age: 25 }, { age: { min: 0, max: 150 } })
      expect(result).toEqual({ valid: true, data: { age: 25 } })
    })

    it('allows min boundary value', () => {
      const result = validate({ age: 0 }, { age: { min: 0 } })
      expect(result).toEqual({ valid: true, data: { age: 0 } })
    })
  })

  describe('pattern matching', () => {
    it('rejects strings not matching pattern', () => {
      const result = validate({ email: 'bad' }, { email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } })
      expect(result).toEqual({ valid: false, error: 'Invalid format for email' })
    })

    it('allows strings matching pattern', () => {
      const result = validate({ email: 'test@example.com' }, { email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } })
      expect(result).toEqual({ valid: true, data: { email: 'test@example.com' } })
    })
  })

  describe('enum validation', () => {
    it('rejects values not in enum', () => {
      const result = validate({ status: 'Unknown' }, { status: { enum: ['Active', 'Inactive'] } })
      expect(result).toEqual({ valid: false, error: 'Invalid value for status: must be one of Active, Inactive' })
    })

    it('allows values in enum', () => {
      const result = validate({ status: 'Active' }, { status: { enum: ['Active', 'Inactive'] } })
      expect(result).toEqual({ valid: true, data: { status: 'Active' } })
    })
  })

  describe('valid data passes', () => {
    it('returns valid with data for fully compliant input', () => {
      const body = { name: 'Test', age: 30, email: 'a@b.com', role: 'Admin' }
      const schema = {
        name: { required: true, type: 'string' as const, maxLength: 100 },
        age: { required: true, type: 'number' as const, min: 0, max: 150 },
        email: { required: true, type: 'string' as const, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        role: { required: true, type: 'string' as const, enum: ['Admin', 'User'] },
      }
      const result = validate(body, schema)
      expect(result).toEqual({ valid: true, data: body })
    })
  })
})

// projects.budget_amount / projects.estimated_hours must be able to hold
// "not tracked" (NULL) as a state distinct from an explicit 0 — a default of
// 0 would make every untracked project read as "0h budgeted, 100% over".
describe('parseNullableNumber', () => {
  it('treats an omitted field as untouched, not as a clear', () => {
    expect(parseNullableNumber(undefined)).toEqual({ ok: true, value: undefined })
  })

  it('maps null and empty string to null (clear back to "not tracked")', () => {
    expect(parseNullableNumber(null)).toEqual({ ok: true, value: null })
    expect(parseNullableNumber('')).toEqual({ ok: true, value: null })
  })

  it('keeps an explicit zero as 0 rather than collapsing it to null', () => {
    expect(parseNullableNumber(0)).toEqual({ ok: true, value: 0 })
    expect(parseNullableNumber('0')).toEqual({ ok: true, value: 0 })
  })

  it('accepts numbers and numeric strings from form inputs', () => {
    expect(parseNullableNumber(1200.5)).toEqual({ ok: true, value: 1200.5 })
    expect(parseNullableNumber('40.25')).toEqual({ ok: true, value: 40.25 })
  })

  it('rejects non-numeric, negative and non-finite input instead of dropping it', () => {
    expect(parseNullableNumber('abc')).toEqual({ ok: false })
    expect(parseNullableNumber(-1)).toEqual({ ok: false })
    expect(parseNullableNumber(Infinity)).toEqual({ ok: false })
    expect(parseNullableNumber(NaN)).toEqual({ ok: false })
    expect(parseNullableNumber({})).toEqual({ ok: false })
    expect(parseNullableNumber(true)).toEqual({ ok: false })
  })
})
