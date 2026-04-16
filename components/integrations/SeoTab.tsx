'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscReport {
  rows?: GscRow[]
  totals?: { clicks: number; impressions: number; ctr: number; position: number }
}

const DATE_RANGES = [7, 14, 28, 90] as const

export default function SeoTab({ gscSiteUrl, days: defaultDays }: { gscSiteUrl?: string; days?: number }) {
  const [days, setDays] = useState(defaultDays ?? 28)
  const [data, setData] = useState<GscReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!gscSiteUrl) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/integrations/gsc/report?site=${encodeURIComponent(gscSiteUrl)}&days=${days}&dimension=query`)
      .then(r => r.ok ? r.json() : { rows: [], totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 } })
      .then(d => setData(d))
      .catch(() => setData({ rows: [], totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 } }))
      .finally(() => setLoading(false))
  }, [gscSiteUrl, days])

  if (!gscSiteUrl) {
    return (
      <div className="metric-card text-center py-12">
        <Search size={24} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No Search Console site configured</p>
      </div>
    )
  }

  const totals = data?.totals ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const rows = (data?.rows ?? [])
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)

  const kpis = [
    { label: 'Clicks', value: totals.clicks.toLocaleString(), color: '#3b82f6' },
    { label: 'Impressions', value: totals.impressions.toLocaleString(), color: '#8b5cf6' },
    { label: 'Avg CTR', value: (totals.ctr * 100).toFixed(2) + '%', color: '#22c55e' },
    { label: 'Avg Position', value: totals.position.toFixed(1), color: '#f59e0b' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Google Search Console</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {DATE_RANGES.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`filter-pill ${days === d ? 'active' : ''}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.color } as React.CSSProperties}>
                <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{k.value}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Top Queries Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Queries</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th>Clicks</th>
                    <th>Impressions</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="font-medium text-gray-900">{row.keys[0]}</td>
                      <td>{row.clicks.toLocaleString()}</td>
                      <td>{row.impressions.toLocaleString()}</td>
                      <td>{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-8">No query data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
