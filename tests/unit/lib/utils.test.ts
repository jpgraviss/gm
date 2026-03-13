import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, getDaysUntil, getInitials } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats positive numbers', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(1234567)).toBe('$1,234,567')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats negative numbers', () => {
    expect(formatCurrency(-500)).toBe('-$500')
  })

  it('rounds to whole dollars', () => {
    expect(formatCurrency(99.99)).toBe('$100')
    expect(formatCurrency(99.49)).toBe('$99')
  })
})

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    const result = formatDate('2026-01-15')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2026')
  })

  it('formats datetime strings', () => {
    const result = formatDate('2026-06-01T12:00:00Z')
    expect(result).toContain('2026')
  })
})

describe('getDaysUntil', () => {
  it('returns positive for future dates', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    const result = getDaysUntil(futureDate.toISOString())
    expect(result).toBeGreaterThanOrEqual(9)
    expect(result).toBeLessThanOrEqual(11)
  })

  it('returns negative for past dates', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5)
    const result = getDaysUntil(pastDate.toISOString())
    expect(result).toBeLessThanOrEqual(-4)
    expect(result).toBeGreaterThanOrEqual(-6)
  })
})

describe('getInitials', () => {
  it('extracts first two initials', () => {
    expect(getInitials('Jonathan Graviss')).toBe('JG')
  })

  it('handles single name', () => {
    expect(getInitials('Jonathan')).toBe('J')
  })

  it('limits to 2 characters', () => {
    expect(getInitials('John Paul Jones')).toBe('JP')
  })

  it('uppercases initials', () => {
    expect(getInitials('john doe')).toBe('JD')
  })
})
