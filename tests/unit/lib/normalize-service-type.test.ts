import { describe, it, expect } from 'vitest'
import { normalizeServiceType, serviceRevenueKind, ALL_SERVICE_VALUES, SERVICE_NAMES } from '@/lib/services'

/**
 * `normalizeServiceType()` is what both importers (CSV and HubSpot) run
 * free-text through before writing `service_type`. When the catalog was
 * restructured it was NOT updated, so it kept emitting the pre-rename names
 * ('SEO / AEO / GEO', 'Social Media', 'Content', 'Design') — meaning every
 * future import would have quietly re-introduced the exact values a data
 * migration had just cleaned up.
 *
 * The invariant that stops that recurring: whatever this returns must be a
 * real, current catalog service name.
 */

describe('normalizeServiceType always returns a current catalog name', () => {
  const samples = [
    'SEO', 'seo basic', 'AEO', 'Georgia Outdoor Advertising', 'Social Media',
    'website redesign', 'Website Maintenance Transfer', 'web design',
    'Google Ads', 'PPC', 'ad spend', 'travel expense', 'Amazon Order',
    'Sales Training Sprint', 'Fractional CMO', 'enablement core build',
    'hourly consulting', 'branding', 'content marketing', 'setup fee',
    'cancellation fee', 'email campaign', 'something unrecognizable', '',
  ]

  it('never emits a value outside the catalog', () => {
    const bad = samples
      .map(s => [s, normalizeServiceType(s)] as const)
      .filter(([, out]) => !SERVICE_NAMES.includes(out as never) && out !== 'General')
    expect(bad).toEqual([])
  })

  it('emits the renamed services, not their old spellings', () => {
    // The actual regression: these used to return 'SEO / AEO / GEO' and
    // 'Social Media', re-seeding stale values on every import.
    expect(normalizeServiceType('SEO')).toBe('SEO Management')
    expect(normalizeServiceType('AEO strategy')).toBe('SEO Management')
    expect(normalizeServiceType('Social Media')).toBe('Social Media Management')
  })

  it('keeps the word-boundary guard so "Georgia" is not read as GEO', () => {
    // A real past bug: 'Georgia Outdoor Advertising' was classified as SEO
    // purely because "Georgia" contains "geo".
    expect(normalizeServiceType('Georgia Outdoor')).not.toBe('SEO Management')
  })

  it('reads maintenance as ongoing, not as a build', () => {
    // This team titles ongoing work "maintenance" — 'Web + Maintenance',
    // 'Website Maintenance Transfer' are both real deal titles. Falling
    // through to the generic 'website' rule would classify a retainer as a
    // one-time build and move it out of recurring revenue.
    expect(normalizeServiceType('Web + Maintenance')).toBe('Website Management')
    expect(normalizeServiceType('Website Maintenance Transfer')).toBe('Website Management')
    expect(normalizeServiceType('website redesign')).toBe('Website Build')
  })

  it('separates advertising spend from the advertising fee', () => {
    // Spend is pass-through, the management fee is revenue. Reading spend
    // as the fee would count a client's media budget as agency revenue.
    expect(normalizeServiceType('Ad Spend')).toBe('Advertising Spend')
    expect(serviceRevenueKind(normalizeServiceType('Ad Spend'))).toBe('pass-through')
    expect(normalizeServiceType('Google Ads')).toBe('Advertising Management')
    expect(serviceRevenueKind(normalizeServiceType('Google Ads'))).toBe('recurring')
  })

  it('routes reimbursables to pass-through', () => {
    expect(serviceRevenueKind(normalizeServiceType('Travel Expense'))).toBe('pass-through')
    expect(serviceRevenueKind(normalizeServiceType('Amazon Order'))).toBe('pass-through')
  })

  it("answers 'General' rather than inventing a service", () => {
    expect(normalizeServiceType('something unrecognizable')).toBe('General')
    expect(normalizeServiceType('')).toBe('General')
    expect(normalizeServiceType(null)).toBe('General')
  })
})

describe('API service validation', () => {
  it('accepts every catalog name and alias', () => {
    // deals/projects/proposals validate serviceType against
    // ALL_SERVICE_VALUES. If a canonical name were missing from that set,
    // the UI's own dropdown would start 400ing.
    for (const name of SERVICE_NAMES) {
      expect(ALL_SERVICE_VALUES).toContain(name)
    }
  })

  it("accepts 'General', the default those routes fall back to", () => {
    expect(ALL_SERVICE_VALUES).toContain('General')
  })
})
