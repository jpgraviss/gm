import { useState, useCallback } from 'react'

export interface EnrichmentResult {
  name?: string
  description?: string
  industry?: string
  logoUrl?: string
  phone?: string
  email?: string
  address?: string
  socialLinks?: Record<string, string>
  ai?: {
    companySize?: string
    keyServices?: string[]
    targetMarket?: string
    linkedInUrl?: string
  }
}

export function useEnrichment() {
  const [enriching, setEnriching] = useState(false)
  const [enrichedFields, setEnrichedFields] = useState<Set<string>>(new Set())

  const enrich = useCallback(async (url: string): Promise<EnrichmentResult | null> => {
    if (!url.trim()) return null
    setEnriching(true)
    try {
      const res = await fetch('/api/crm/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    } finally {
      setEnriching(false)
    }
  }, [])

  const markEnriched = useCallback((fields: string[]) => {
    setEnrichedFields(prev => {
      const next = new Set(prev)
      fields.forEach(f => next.add(f))
      return next
    })
  }, [])

  const clearEnriched = useCallback((field: string) => {
    setEnrichedFields(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }, [])

  const clearAllEnriched = useCallback(() => {
    setEnrichedFields(new Set())
  }, [])

  return { enriching, enrichedFields, enrich, markEnriched, clearEnriched, clearAllEnriched }
}
