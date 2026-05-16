'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { Deal, Invoice, RevenueMonth } from '@/lib/types'

type DateRange = '3M' | '6M' | '12M'

const STAGE_WEIGHTS: Record<string, number> = {
  Lead: 0.1,
  Qualified: 0.25,
  'Proposal Sent': 0.5,
  'Contract Sent': 0.75,
  'Closed Won': 1.0,
  'Closed Lost': 0,
}

export default function RevenueReportPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('6M')
  const [deals, setDeals] = useState<Deal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonth[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/deals').then(r => r.ok ? r.json() : []),
      fetch('/api/invoices').then(r => r.ok ? r.json() : []),
      fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(d => d?.revenueByMonth ?? []),
    ]).then(([d, i, rev]) => {
      if (Array.isArray(d)) setDeals(d)
      if (Array.isArray(i)) setInvoices(i)
      if (Array.isArray(rev)) setRevenueByMonth(rev)
    }).catch(() => toast('Failed to load revenue data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const monthsToShow = dateRange === '3M' ? 3 : dateRange === '6M' ? 6 : revenueByMonth.length
  const visibleMonths = revenueByMonth.slice(-monthsToShow)
  const maxRevenue = Math.max(...visibleMonths.map(r => r.revenue), 1)

  const pipelineForecast = useMemo(() => {
    const stages: Record<string, { count: number; value: number; weighted: number }> = {}
    deals.filter(d => d.stage !== 'Closed Lost').forEach(d => {
      if (!stages[d.stage]) stages[d.stage] = { count: 0, value: 0, weighted: 0 }
      stages[d.stage].count++
      stages[d.stage].value += d.value
      stages[d.stage].weighted += d.value * (STAGE_WEIGHTS[d.stage] ?? 0)
    })
    return Object.entries(stages)
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => (STAGE_WEIGHTS[b.stage] ?? 0) - (STAGE_WEIGHTS[a.stage] ?? 0))
  }, [deals])

  const totalWeighted = pipelineForecast.reduce((s, p) => s + p.weighted, 0)
  const closedWon = deals.filter(d => d.stage === 'Closed Won')
  const closedWonTotal = closedWon.reduce((s, d) => s + d.value, 0)
  const collected = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)

  const topDeals = useMemo(() => {
    return [...deals]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [deals])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Revenue Report" subtitle="Revenue trends, pipeline forecast, and top deals" />
      <div className="page-content">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period:</span>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {(['3M', '6M', '12M'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${dateRange === r ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ background: dateRange === r ? '#015035' : undefined }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Revenue', value: formatCurrency(visibleMonths.reduce((s, r) => s + r.revenue, 0)), color: '#015035' },
            { label: 'Collected', value: formatCurrency(collected), color: '#22c55e' },
            { label: 'Closed Won', value: formatCurrency(closedWonTotal), color: '#3b82f6' },
            { label: 'Pipeline (Weighted)', value: formatCurrency(totalWeighted), color: '#f59e0b' },
          ].map(m => (
            <div key={m.label} className="kpi-card">
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: m.color }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div className="metric-card mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">Monthly Revenue</h3>
              <p className="text-xs text-gray-400 mt-0.5">{dateRange} view</p>
            </div>
            <p className="text-lg font-bold" style={{ color: '#015035' }}>
              {formatCurrency(visibleMonths.reduce((s, r) => s + r.revenue, 0))}
            </p>
          </div>
          <div className="flex items-end gap-3 h-40">
            {visibleMonths.map(d => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400 font-medium">{formatCurrency(d.revenue).replace('$', '')}</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${(d.revenue / maxRevenue) * 120}px`, background: '#015035' }}
                />
                <span className="text-[10px] text-gray-400">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Pipeline Forecast</h3>
            <div className="flex flex-col gap-3">
              {pipelineForecast.map(p => (
                <div key={p.stage}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-700 font-medium">{p.stage} ({p.count})</span>
                    <span className="text-xs font-bold text-gray-800">{formatCurrency(p.weighted)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${totalWeighted > 0 ? (p.weighted / totalWeighted) * 100 : 0}%`, background: '#015035' }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-16 text-right">{formatCurrency(p.value)} total</span>
                  </div>
                </div>
              ))}
              {pipelineForecast.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No active deals in pipeline</p>
              )}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Top Deals</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Company</th>
                    <th className="text-right pb-2 font-semibold">Value</th>
                    <th className="text-right pb-2 font-semibold">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {topDeals.map(d => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-sm text-gray-800 font-medium">{d.company}</td>
                      <td className="py-2 text-sm font-bold text-right" style={{ color: '#015035' }}>{formatCurrency(d.value)}</td>
                      <td className="py-2 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          d.stage === 'Closed Won' ? 'bg-green-100 text-green-700' :
                          d.stage === 'Closed Lost' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>{d.stage}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
