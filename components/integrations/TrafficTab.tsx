'use client'

import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'

interface Summary {
  sessions: number
  users: number
  pageviews: number
  avgSessionDurationSec: number
  bounceRate: number
}

interface TopPage { path: string; title: string; sessions: number }
interface Source { channel: string; sessions: number }

interface GA4Report {
  summary: Summary
  topPages: TopPage[]
  sources: Source[]
  days: number
}

const DAY_OPTIONS = [7, 14, 28, 90] as const

interface Props {
  ga4PropertyId?: string
  days?: number
}

export default function TrafficTab({ ga4PropertyId, days: defaultDays }: Props) {
  const [days, setDays] = useState(defaultDays ?? 28)
  const [report, setReport] = useState<GA4Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ga4PropertyId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fetch(`/api/integrations/ga4/report?propertyId=${encodeURIComponent(ga4PropertyId)}&days=${days}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics data')
        return r.json() as Promise<GA4Report>
      })
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [ga4PropertyId, days])

  if (!ga4PropertyId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <BarChart3 size={32} />
        <p className="text-sm">No Analytics property configured</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Date range pills */}
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-emerald-600" />
        <span className="text-sm font-semibold text-gray-800 mr-2">Traffic</span>
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              days === d
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
        </div>
      )}

      {error && <p className="text-sm text-red-600 py-4">{error}</p>}

      {!loading && report && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['Sessions', report.summary.sessions.toLocaleString()],
              ['Users', report.summary.users.toLocaleString()],
              ['Pageviews', report.summary.pageviews.toLocaleString()],
              ['Bounce Rate', `${(report.summary.bounceRate * 100).toFixed(1)}%`],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-200 p-4">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Pages */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Pages</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-600">Page</th>
                    <th className="pb-2 font-medium text-gray-600 text-right">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topPages.slice(0, 10).map((p) => (
                    <tr key={p.path} className="border-b border-gray-100">
                      <td className="py-2 text-gray-800 truncate max-w-[200px]" title={p.title || p.path}>
                        {p.title || p.path}
                      </td>
                      <td className="py-2 text-gray-600 text-right tabular-nums">
                        {p.sessions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Traffic Sources */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Traffic Sources</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 font-medium text-gray-600">Channel</th>
                    <th className="pb-2 font-medium text-gray-600 text-right">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.slice(0, 10).map((s) => (
                    <tr key={s.channel} className="border-b border-gray-100">
                      <td className="py-2 text-gray-800">{s.channel}</td>
                      <td className="py-2 text-gray-600 text-right tabular-nums">
                        {s.sessions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
