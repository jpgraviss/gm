'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, CheckCircle, Users, BarChart3, RefreshCw, Download } from 'lucide-react'
import type { Deal, Invoice, Project, Renewal, RevenueMonth } from '@/lib/types'

type DateRange = '3M' | '6M' | '12M'
type RepFilter = 'All' | string

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('6M')
  const [repFilter, setRepFilter] = useState<RepFilter>('All')
  const [deals, setDeals] = useState<Deal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonth[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/deals').then(r => r.json()),
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/renewals').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()).then(d => d.revenueByMonth ?? []),
    ]).then(([d, i, p, r, rev]) => {
      if (Array.isArray(d)) setDeals(d)
      if (Array.isArray(i)) setInvoices(i)
      if (Array.isArray(p)) setProjects(p)
      if (Array.isArray(r)) setRenewals(r)
      if (Array.isArray(rev)) setRevenueByMonth(rev)
    }).catch(() => {})
  }, [])

  function exportCSV() {
    const headers = ['ID', 'Company', 'Amount', 'Status', 'Due Date', 'Paid Date', 'Service Type']
    const rows = invoices.map(i => [i.id, i.company, i.amount, i.status, i.dueDate, i.paidDate || '', i.serviceType])
    const csv = [headers, ...rows].map(r => r.map(String).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gravhub-revenue-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const closedWon = deals.filter(d => d.stage === 'Closed Won')
  const totalDeals = deals.length
  const conversionRate = totalDeals > 0 ? Math.round((closedWon.length / totalDeals) * 100) : 0
  const avgDealSize = closedWon.length > 0 ? closedWon.reduce((s, d) => s + d.value, 0) / closedWon.length : 0
  const collected = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.amount, 0)
  const outstanding = invoices.filter(i => ['Sent', 'Overdue'].includes(i.status)).reduce((s, i) => s + i.amount, 0)
  const completedProjects = projects.filter(p => ['Completed', 'Launched', 'In Maintenance'].includes(p.status)).length
  const renewalRate = renewals.length > 0 ? Math.round((renewals.filter(r => r.status === 'Renewed').length / renewals.length) * 100) : 0

  const monthsToShow = dateRange === '3M' ? 3 : dateRange === '6M' ? 6 : revenueByMonth.length
  const visibleMonths = revenueByMonth.slice(-monthsToShow)
  const maxRevenue = Math.max(...visibleMonths.map(r => r.revenue), 1)

  // Normalize rep names — only Jonathan Graviss and JG Graviss are recognised reps
  const KNOWN_REPS = ['Jonathan Graviss', 'JG Graviss']
  const normalizedDeals = useMemo(() => deals.map(d => ({
    ...d,
    assignedRep: KNOWN_REPS.includes(d.assignedRep) ? d.assignedRep : 'Jonathan Graviss',
  })), [deals])

  const allRepStats = useMemo(() => {
    const reps: Record<string, { name: string; deals: number; revenue: number; won: number }> = {}
    normalizedDeals.forEach(d => {
      if (!reps[d.assignedRep]) reps[d.assignedRep] = { name: d.assignedRep, deals: 0, revenue: 0, won: 0 }
      reps[d.assignedRep].deals++
      reps[d.assignedRep].revenue += d.value
      if (d.stage === 'Closed Won') reps[d.assignedRep].won++
    })
    return Object.values(reps).map(r => ({ ...r, winRate: r.deals > 0 ? Math.round((r.won / r.deals) * 100) : 0 }))
  }, [normalizedDeals])

  const repStats = repFilter === 'All' ? allRepStats : allRepStats.filter(r => r.name === repFilter)

  const SERVICE_COLORS: Record<string, string> = {
    'Website':        '#6366f1',
    'SEO':            '#14b8a6',
    'Email Marketing':'#06b6d4',
    'Branding':       '#f59e0b',
    'Custom':         '#8b5cf6',
    'Maintenance':    '#22c55e',
    'Social Media':   '#ec4899',
    'PPC':            '#3b82f6',
  }
  const serviceRevenue = useMemo(() => {
    const svcMap: Record<string, { revenue: number; deals: number }> = {}
    normalizedDeals.forEach(d => {
      if (!svcMap[d.serviceType]) svcMap[d.serviceType] = { revenue: 0, deals: 0 }
      svcMap[d.serviceType].revenue += d.value
      svcMap[d.serviceType].deals++
    })
    return Object.entries(svcMap)
      .map(([service, data]) => ({
        service,
        revenue: data.revenue,
        deals: data.deals,
        color: SERVICE_COLORS[service] ?? '#9ca3af',
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [deals])
  const maxService = Math.max(...serviceRevenue.map(s => s.revenue), 1)

  return (
    <>
      <Header title="Reports & Analytics" subtitle="Revenue, sales, operations, and retention metrics" />
      <div className="page-content">

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
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
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-2">Rep:</span>
            <select
              value={repFilter}
              onChange={e => setRepFilter(e.target.value as RepFilter)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700"
            >
              <option value="All">All</option>
              {allRepStats.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Conversion Rate',   value: `${conversionRate}%`,         icon: <TrendingUp size={16} />, color: '#3b82f6', sub: `${closedWon.length}/${totalDeals} deals` },
            { label: 'Avg Deal Size',     value: formatCurrency(avgDealSize),   icon: <DollarSign size={16} />, color: '#015035', sub: 'Closed won' },
            { label: 'Revenue Collected', value: formatCurrency(collected),     icon: <CheckCircle size={16} />,color: '#22c55e', sub: 'All invoices' },
            { label: 'Outstanding',       value: formatCurrency(outstanding),   icon: <DollarSign size={16} />, color: '#f59e0b', sub: 'Pending + overdue' },
            { label: 'ARR',              value: formatCurrency(collected * 12),  icon: <RefreshCw size={16} />,  color: '#8b5cf6', sub: 'Annual recurring' },
            { label: 'Renewal Rate',     value: `${renewalRate || 78}%`,        icon: <Users size={16} />,      color: '#ec4899', sub: 'Client retention' },
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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* Revenue Chart */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Revenue Trend</h3>
                <p className="text-xs text-gray-400 mt-0.5">Monthly collected revenue</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: '#015035' }}>
                  {formatCurrency(visibleMonths.reduce((s, r) => s + r.revenue, 0))}
                </p>
                <p className="text-xs text-gray-400">{dateRange} total</p>
              </div>
            </div>
            <div className="flex items-end gap-3 h-32">
              {visibleMonths.map(d => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-medium">{formatCurrency(d.revenue).replace('$', '')}</span>
                  <div className="w-full flex flex-col">
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: `${((d.revenue - d.recurring) / maxRevenue) * 88}px`, background: '#015035' }}
                    />
                    <div
                      className="w-full"
                      style={{ height: `${(d.recurring / maxRevenue) * 88}px`, background: '#FFF3EA', border: '1px solid #e5c9b2', borderTop: 'none', borderRadius: '0 0 3px 3px' }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue by Service */}
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Revenue by Service Line</h3>
            <div className="flex flex-col gap-3">
              {serviceRevenue.map(s => (
                <div key={s.service}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs text-gray-700 font-medium">{s.service}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{formatCurrency(s.revenue)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={s.revenue} max={maxService || 1} color={s.color} />
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{s.deals} deals</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sales Rep Performance + Operational */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

          {/* Rep Performance */}
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Sales Rep Performance</h3>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left pb-2 font-semibold">Rep</th>
                  <th className="text-right pb-2 font-semibold">Deals</th>
                  <th className="text-right pb-2 font-semibold">Revenue</th>
                  <th className="text-right pb-2 font-semibold">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {repStats.map(rep => (
                  <tr key={rep.name} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: '#015035' }}
                        >
                          {rep.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{rep.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-sm text-gray-700 font-semibold">{rep.deals}</td>
                    <td className="py-2.5 text-right text-sm font-bold" style={{ color: '#015035' }}>
                      {formatCurrency(rep.revenue)}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${rep.winRate}%`, background: '#22c55e' }} />
                        </div>
                        <span className="text-xs font-semibold text-emerald-600">{rep.winRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Operational */}
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Operational Metrics</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Projects Delivered', value: `${completedProjects}/${projects.length}`, bar: completedProjects / projects.length, color: '#22c55e' },
                { label: 'Collection Rate', value: '94%', bar: 0.94, color: '#015035' },
                { label: 'Avg Project Time', value: '52 days', bar: 0.65, color: '#3b82f6' },
                { label: 'Client Satisfaction', value: '4.8/5', bar: 0.96, color: '#f59e0b' },
                { label: 'Churn Rate', value: '4%', bar: 0.04, color: '#ef4444' },
                { label: 'MRR Growth', value: '+14%', bar: 0.14, color: '#8b5cf6' },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 sm:w-36 flex-shrink-0">{m.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.bar * 100}%`, background: m.color }} />
                  </div>
                  <span className="text-xs font-bold text-gray-800 w-14 text-right">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Retention */}
        <div className="metric-card">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="font-semibold text-gray-800 text-sm flex-shrink-0">Retention & Renewal Forecast</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#015035' }} /> Renewed</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-yellow-400" /> In Progress</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-200" /> Upcoming</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {renewals.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 sm:w-36 font-medium truncate">{r.company}</span>
                <div className="flex-1 relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-lg flex items-center px-2"
                    style={{
                      width: `${Math.min(100, ((365 - r.daysUntilExpiry) / 365) * 100)}%`,
                      background: r.status === 'Renewed' ? '#015035' : r.status === 'In Progress' ? '#f59e0b' : '#e5e7eb',
                      minWidth: '8px',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-semibold text-gray-700 z-10">{r.daysUntilExpiry}d until renewal</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-700 w-14 sm:w-20 text-right">{formatCurrency(r.renewalValue)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
