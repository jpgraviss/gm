'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { RefreshCw, TrendingUp, DollarSign, Users, HelpCircle } from 'lucide-react'

interface AttributionBucket {
  source: string
  medium: string
  campaign: string
  contacts: number
  deals: number
  wonDeals: number
  wonRevenue: number
  pipelineValue: number
}

interface AttributionData {
  buckets: AttributionBucket[]
  unattributed: { deals: number; wonRevenue: number; pipelineValue: number }
  coverage: { totalContacts: number; sourcedContacts: number }
}

export default function AttributionReportPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AttributionData | null>(null)

  function loadData() {
    setLoading(true)
    fetch('/api/reports/attribution')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .catch(() => toast('Failed to load attribution data', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    if (!data) return { attributedRevenue: 0, attributedPipeline: 0, coveragePct: 0 }
    const attributedRevenue = data.buckets.reduce((s, b) => s + b.wonRevenue, 0)
    const attributedPipeline = data.buckets.reduce((s, b) => s + b.pipelineValue, 0)
    const coveragePct = data.coverage.totalContacts > 0
      ? Math.round((data.coverage.sourcedContacts / data.coverage.totalContacts) * 100)
      : 0
    return { attributedRevenue, attributedPipeline, coveragePct }
  }, [data])

  if (loading) return <LoadingScreen />

  const buckets = data?.buckets ?? []
  const unattributed = data?.unattributed ?? { deals: 0, wonRevenue: 0, pipelineValue: 0 }

  return (
    <>
      <Header title="Attribution" subtitle="Which channels actually produce revenue — source → deal → revenue" />
      <div className="page-content">

        <div className="flex justify-end mb-4">
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Attributed Revenue', value: formatCurrency(totals.attributedRevenue), icon: <DollarSign size={16} />, color: '#015035', sub: 'Closed Won, source known' },
            { label: 'Attributed Pipeline', value: formatCurrency(totals.attributedPipeline), icon: <TrendingUp size={16} />, color: '#3b82f6', sub: 'Open deals, source known' },
            { label: 'Attribution Coverage', value: `${totals.coveragePct}%`, icon: <Users size={16} />, color: '#8b5cf6', sub: `${data?.coverage.sourcedContacts ?? 0}/${data?.coverage.totalContacts ?? 0} contacts` },
            { label: 'Unattributed Revenue', value: formatCurrency(unattributed.wonRevenue), icon: <HelpCircle size={16} />, color: '#9ca3af', sub: `${unattributed.deals} deals, no source` },
          ].map(m => (
            <div key={m.label} className="kpi-card" style={{ '--kpi-accent': m.color } as React.CSSProperties}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${m.color}15` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{m.label}</p>
              <p className="text-[11px] text-gray-400 mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        {totals.coveragePct < 100 && (
          <div className="mb-6 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
            Attribution only covers contacts created since UTM capture was added to public funnels and forms —
            {' '}{(data?.coverage.totalContacts ?? 0) - (data?.coverage.sourcedContacts ?? 0)} existing contact(s) predate it and will never show a source.
            Coverage grows automatically as new leads convert through a tracked link.
          </div>
        )}

        {/* Source breakdown */}
        <div className="metric-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Revenue by Source</h3>
          {buckets.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No source-attributed deals yet. Once a visitor arrives via a tracked (`?utm_source=...`) link and converts, they&apos;ll show up here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Source</th>
                    <th className="text-left pb-2 font-semibold">Medium</th>
                    <th className="text-left pb-2 font-semibold">Campaign</th>
                    <th className="text-right pb-2 font-semibold">Contacts</th>
                    <th className="text-right pb-2 font-semibold">Deals</th>
                    <th className="text-right pb-2 font-semibold">Won</th>
                    <th className="text-right pb-2 font-semibold">Won Revenue</th>
                    <th className="text-right pb-2 font-semibold">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map(b => (
                    <tr key={`${b.source}::${b.medium}::${b.campaign}`} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 text-sm font-semibold text-gray-800">{b.source}</td>
                      <td className="py-2.5 text-sm text-gray-600">{b.medium}</td>
                      <td className="py-2.5 text-sm text-gray-600 truncate max-w-[200px]">{b.campaign}</td>
                      <td className="py-2.5 text-right text-sm text-gray-700">{b.contacts}</td>
                      <td className="py-2.5 text-right text-sm text-gray-700">{b.deals}</td>
                      <td className="py-2.5 text-right text-sm text-gray-700">{b.wonDeals}</td>
                      <td className="py-2.5 text-right text-sm font-bold" style={{ color: '#015035' }}>{formatCurrency(b.wonRevenue)}</td>
                      <td className="py-2.5 text-right text-sm text-gray-500">{formatCurrency(b.pipelineValue)}</td>
                    </tr>
                  ))}
                  {(unattributed.deals > 0) && (
                    <tr className="bg-gray-50/50">
                      <td className="py-2.5 text-sm font-medium text-gray-400" colSpan={3}>Unknown / no source</td>
                      <td className="py-2.5 text-right text-sm text-gray-400">—</td>
                      <td className="py-2.5 text-right text-sm text-gray-400">{unattributed.deals}</td>
                      <td className="py-2.5 text-right text-sm text-gray-400">—</td>
                      <td className="py-2.5 text-right text-sm font-medium text-gray-500">{formatCurrency(unattributed.wonRevenue)}</td>
                      <td className="py-2.5 text-right text-sm text-gray-400">{formatCurrency(unattributed.pipelineValue)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
