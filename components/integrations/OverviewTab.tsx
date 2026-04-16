'use client'

import { useEffect, useState } from 'react'
import { MousePointerClick, Users, DollarSign, Star, Search, Globe, Loader2 } from 'lucide-react'

interface Binding {
  gscSiteUrl?: string
  ga4PropertyId?: string
  adsCustomerId?: string
  gbpLocationName?: string
}

interface KPI {
  label: string
  value: string | null
  icon: React.ReactNode
  gray?: boolean
}

export default function OverviewTab({ clientName }: { clientName?: string }) {
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<KPI[]>([])

  useEffect(() => {
    if (!clientName) return
    let cancelled = false

    async function load() {
      setLoading(true)

      // 1. Fetch binding
      const bindRes = await fetch(
        `/api/client-integrations?company=${encodeURIComponent(clientName!)}`,
      )
      const bindings = bindRes.ok ? await bindRes.json() : []
      const b: Binding = Array.isArray(bindings) && bindings.length > 0 ? bindings[0] : {}

      // 2. Fetch all KPIs in parallel
      const [gsc, ga4, ads, gbp, kw, sites] = await Promise.all([
        b.gscSiteUrl
          ? fetch(`/api/integrations/gsc/report?site=${encodeURIComponent(b.gscSiteUrl)}&days=28`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        b.ga4PropertyId
          ? fetch(`/api/integrations/ga4/report?propertyId=${encodeURIComponent(b.ga4PropertyId)}&days=28`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        b.adsCustomerId
          ? fetch(`/api/integrations/ads/report?customerId=${encodeURIComponent(b.adsCustomerId)}&days=28`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        b.gbpLocationName
          ? fetch(`/api/integrations/gbp/reviews?location=${encodeURIComponent(b.gbpLocationName)}&days=28`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        fetch(`/api/tracked-keywords?company=${encodeURIComponent(clientName!)}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetch(`/api/monitored-sites?company=${encodeURIComponent(clientName!)}`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ])

      if (cancelled) return

      const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

      const sitesForClient = Array.isArray(sites)
        ? sites.filter((s: { companyName?: string }) => s.companyName === clientName)
        : []

      const avgUptime =
        sitesForClient.length > 0
          ? (
              sitesForClient.reduce(
                (sum: number, s: { uptime30d?: number }) => sum + (s.uptime30d ?? 0),
                0,
              ) / sitesForClient.length
            ).toFixed(1) + '%'
          : null

      setCards([
        {
          label: 'Total Clicks',
          icon: <MousePointerClick size={18} />,
          value: gsc ? fmt(gsc.summary?.totalClicks ?? 0) : null,
          gray: !b.gscSiteUrl,
        },
        {
          label: 'Sessions',
          icon: <Users size={18} />,
          value: ga4 ? fmt(ga4.summary?.sessions ?? 0) : null,
          gray: !b.ga4PropertyId,
        },
        {
          label: 'Ad Spend',
          icon: <DollarSign size={18} />,
          value: ads
            ? `$${Number(ads.summary?.totalCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : null,
          gray: !b.adsCustomerId,
        },
        {
          label: 'Avg Rating',
          icon: <Star size={18} />,
          value: gbp ? `${Number(gbp.averageRating ?? 0).toFixed(1)} ★` : null,
          gray: !b.gbpLocationName,
        },
        {
          label: 'Keywords Tracked',
          icon: <Search size={18} />,
          value: String(Array.isArray(kw) ? kw.length : 0),
        },
        {
          label: 'Sites Monitored',
          icon: <Globe size={18} />,
          value: sitesForClient.length > 0
            ? `${sitesForClient.length}${avgUptime ? ` · ${avgUptime}` : ''}`
            : '0',
        },
      ])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [clientName])

  if (!clientName) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        Select a client to view overview
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin" style={{ color: '#015035' }} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <span style={{ color: '#015035' }}>{c.icon}</span>
            <span className="text-xs font-medium text-gray-500">{c.label}</span>
          </div>
          {c.gray && c.value === null ? (
            <span className="text-lg font-semibold text-gray-300">Not connected</span>
          ) : (
            <span className="text-2xl font-bold" style={{ color: '#015035' }}>
              {c.value ?? '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
