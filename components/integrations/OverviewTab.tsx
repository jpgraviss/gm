'use client'

import { useEffect, useState } from 'react'
import {
  MousePointerClick, Users, DollarSign, Star, Search, Globe, Loader2,
  Check, Minus, Settings2, ExternalLink,
} from 'lucide-react'
import ClientIntegrationsPanel from '@/components/crm/ClientIntegrationsPanel'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Binding {
  id?: string
  companyName: string
  gscSiteUrl?: string
  ga4PropertyId?: string
  adsCustomerId?: string
  metaAdAccountId?: string
  gbpLocationName?: string
  updatedAt?: string
}

interface KPI {
  label: string
  value: string | null
  icon: React.ReactNode
  gray?: boolean
}

interface Props {
  clientName?: string
  allBindings: Binding[]
  onSelectClient: (name: string) => void
  onBindingsChanged: () => void
}

/* ------------------------------------------------------------------ */
/*  Integration column definitions                                     */
/* ------------------------------------------------------------------ */

const INTEGRATION_COLS = [
  { key: 'gscSiteUrl'      as const, label: 'GSC',        short: 'GSC' },
  { key: 'ga4PropertyId'   as const, label: 'GA4',        short: 'GA4' },
  { key: 'adsCustomerId'   as const, label: 'Google Ads', short: 'Ads' },
  { key: 'gbpLocationName' as const, label: 'GBP',        short: 'GBP' },
  { key: 'metaAdAccountId' as const, label: 'Meta Ads',   short: 'Meta' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(iso?: string): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function StatusCell({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50">
      <Check size={14} className="text-emerald-600" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-50">
      <Minus size={14} className="text-gray-300" />
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OverviewTab({ clientName, allBindings, onSelectClient, onBindingsChanged }: Props) {
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<KPI[]>([])
  const [configureCompany, setConfigureCompany] = useState<string | null>(null)

  /* ---- Per-client KPI loading (existing logic) ---- */
  useEffect(() => {
    if (!clientName) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const bindRes = await fetch(
        `/api/client-integrations?company=${encodeURIComponent(clientName!)}`,
      )
      const bindings = bindRes.ok ? await bindRes.json() : []
      const b: Binding = Array.isArray(bindings) && bindings.length > 0 ? bindings[0] : {}

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

  /* ---- Derived stats for summary header ---- */
  const totalClients = allBindings.length
  const connectedCounts = INTEGRATION_COLS.map(col => ({
    label: col.short,
    count: allBindings.filter(b => !!b[col.key]).length,
  }))
  const fullyConnected = allBindings.filter(b =>
    INTEGRATION_COLS.every(col => !!b[col.key]),
  ).length

  return (
    <div className="flex flex-col gap-6">

      {/* ============================================================ */}
      {/*  ALL CLIENTS AT A GLANCE                                      */}
      {/* ============================================================ */}
      <div className="rounded-xl border border-gray-100 bg-white">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">All Clients at a Glance</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalClients} client{totalClients !== 1 ? 's' : ''}
              {totalClients > 0 && (
                <> &middot; {fullyConnected} fully connected &middot; {connectedCounts.map(c => `${c.label}: ${c.count}`).join(', ')}</>
              )}
            </p>
          </div>
        </div>

        {totalClients === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No client integration bindings found. Go to{' '}
            <a href="/crm/companies" className="font-medium underline text-gray-600 hover:text-gray-900">
              CRM &rarr; Companies
            </a>{' '}
            to bind integrations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 sm:px-5 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Client
                  </th>
                  {INTEGRATION_COLS.map(col => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col.short}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Last Updated
                  </th>
                  <th className="px-4 sm:px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {allBindings
                  .slice()
                  .sort((a, b) => a.companyName.localeCompare(b.companyName))
                  .map(b => {
                    const connectedCount = INTEGRATION_COLS.filter(col => !!b[col.key]).length
                    const isSelected = b.companyName === clientName

                    return (
                      <tr
                        key={b.companyName}
                        className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {/* Client name */}
                        <td className="px-4 sm:px-5 py-3">
                          <button
                            onClick={() => onSelectClient(b.companyName)}
                            className="text-left group"
                          >
                            <span className="text-sm font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">
                              {b.companyName}
                            </span>
                            <span className="block text-[11px] text-gray-400 mt-0.5">
                              {connectedCount}/{INTEGRATION_COLS.length} connected
                            </span>
                          </button>
                        </td>

                        {/* Integration status cells */}
                        {INTEGRATION_COLS.map(col => (
                          <td key={col.key} className="px-3 py-3 text-center">
                            <StatusCell connected={!!b[col.key]} />
                          </td>
                        ))}

                        {/* Last updated */}
                        <td className="px-3 py-3 text-center">
                          {b.updatedAt ? (
                            <span className="text-[11px] text-gray-400" title={new Date(b.updatedAt).toLocaleString()}>
                              {relativeTime(b.updatedAt)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-300">&mdash;</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 sm:px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setConfigureCompany(b.companyName)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                              title="Configure integrations"
                            >
                              <Settings2 size={12} />
                              <span className="hidden sm:inline">Configure</span>
                            </button>
                            <button
                              onClick={() => onSelectClient(b.companyName)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-white transition-colors hover:opacity-90"
                              style={{ background: '#015035' }}
                              title="View details"
                            >
                              <ExternalLink size={12} />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/*  PER-CLIENT KPI CARDS (existing)                              */}
      {/* ============================================================ */}
      {clientName && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">{clientName}</h3>
            <span className="text-xs text-gray-400">28-day snapshot</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: '#015035' }} />
            </div>
          ) : (
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
          )}
        </>
      )}

      {!clientName && (
        <div className="flex items-center justify-center py-10 text-sm text-gray-400">
          Select a client above to view their 28-day performance snapshot
        </div>
      )}

      {/* ============================================================ */}
      {/*  Configure panel                                              */}
      {/* ============================================================ */}
      {configureCompany && (
        <ClientIntegrationsPanel
          companyName={configureCompany}
          onClose={() => {
            setConfigureCompany(null)
            onBindingsChanged()
          }}
        />
      )}
    </div>
  )
}
