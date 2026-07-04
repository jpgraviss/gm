'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/layout/Header'
import OverviewTab from '@/components/integrations/OverviewTab'
import SeoTab from '@/components/integrations/SeoTab'
import TrafficTab from '@/components/integrations/TrafficTab'
import AdsTab from '@/components/integrations/AdsTab'
import ReputationTab from '@/components/integrations/ReputationTab'
import {
  LayoutDashboard, Search, BarChart3, Megaphone, Star, ChevronDown,
} from 'lucide-react'

type Tab = 'overview' | 'seo' | 'traffic' | 'ads' | 'reputation'

interface ClientBinding {
  id?: string
  companyName: string
  gscSiteUrl?: string
  ga4PropertyId?: string
  adsCustomerId?: string
  metaAdAccountId?: string
  gbpLocationName?: string
  updatedAt?: string
}

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={14} /> },
  { id: 'seo',        label: 'SEO',        icon: <Search size={14} /> },
  { id: 'traffic',    label: 'Traffic',    icon: <BarChart3 size={14} /> },
  { id: 'ads',        label: 'Ads',        icon: <Megaphone size={14} /> },
  { id: 'reputation', label: 'Reputation', icon: <Star size={14} /> },
]

export default function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [bindings, setBindings] = useState<ClientBinding[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [days, setDays] = useState(28)

  useEffect(() => {
    fetch('/api/client-integrations')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (Array.isArray(data)) {
          setBindings(data)
          if (data.length > 0 && !selectedClient) {
            setSelectedClient(data[0].companyName)
          }
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const binding = useMemo(
    () => bindings.find(b => b.companyName === selectedClient),
    [bindings, selectedClient],
  )

  const clientNames = useMemo(() => bindings.map(b => b.companyName).sort(), [bindings])

  return (
    <>
      <Header
        title="Integrations Dashboard"
        subtitle={binding ? `${selectedClient} — live data` : 'Select a client to view integration data'}
      />
      <div className="p-3 sm:p-6 flex-1 flex flex-col gap-4">

        {/* Client selector + date range */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
            >
              <option value="">Select client…</option>
              {clientNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex gap-1">
            {[7, 14, 28, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  days === d
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* No bindings help */}
        {clientNames.length === 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-xs text-amber-800 flex-1">
              No client integration bindings found. Go to <strong>CRM → Companies</strong>, open a company, and click the chart icon to bind their GSC, Analytics, Ads, and Business Profile properties.
            </span>
            <a href="/crm/companies" className="text-xs font-semibold text-amber-900 underline whitespace-nowrap">Go to Companies →</a>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-emerald-600 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && (
          <OverviewTab
            clientName={selectedClient || undefined}
            allBindings={bindings}
            onSelectClient={setSelectedClient}
            onBindingsChanged={() => {
              fetch('/api/client-integrations')
                .then(r => (r.ok ? r.json() : []))
                .then(data => { if (Array.isArray(data)) setBindings(data) })
                .catch(() => {})
            }}
          />
        )}
        {tab === 'seo' && (
          <SeoTab gscSiteUrl={binding?.gscSiteUrl} days={days} />
        )}
        {tab === 'traffic' && (
          <TrafficTab ga4PropertyId={binding?.ga4PropertyId} days={days} />
        )}
        {tab === 'ads' && (
          <AdsTab
            adsCustomerId={binding?.adsCustomerId}
            metaAdAccountId={binding?.metaAdAccountId}
            days={days}
          />
        )}
        {tab === 'reputation' && (
          <ReputationTab gbpLocationName={binding?.gbpLocationName} days={days} />
        )}
      </div>
    </>
  )
}
