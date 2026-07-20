'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { RefreshCw } from 'lucide-react'
import type { Deal, Renewal, Invoice, CRMCompany } from '@/lib/types'
import { fetchAllPages } from '@/lib/fetch-all-pages'

type DateRange = '30D' | '90D' | '12M' | 'Custom'
type HealthFilter = 'All' | 'Green' | 'Yellow' | 'Red'

interface TicketRow {
  id: string
  company?: string
  status: string
  created_at?: string
}

interface ClientHealth {
  id: string
  name: string
  status: string
  healthScore: number
  healthLabel: 'Green' | 'Yellow' | 'Red'
  healthColor: string
  totalDealValue: number
  openTickets: number
  renewalDays: number | null
  lastActivity: string
  factors: { label: string; impact: 'positive' | 'neutral' | 'negative' }[]
}

function computeHealth(
  company: CRMCompany,
  deals: Deal[],
  renewals: Renewal[],
  invoices: Invoice[],
  tickets: TicketRow[],
): ClientHealth {
  let score = 50

  const companyDeals = deals.filter(d => d.company === company.name)
  const closedWon = companyDeals.filter(d => d.stage === 'Closed Won')
  const totalValue = closedWon.reduce((s, d) => s + d.value, 0)

  const companyRenewals = renewals.filter(r => r.company === company.name)
  const nextRenewal = companyRenewals.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)[0]
  const renewalDays = nextRenewal?.daysUntilExpiry ?? null

  const companyTickets = tickets.filter(t => t.company === company.name)
  const openTickets = companyTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length

  const companyInvoices = invoices.filter(i => i.company === company.name)
  const overdueInvoices = companyInvoices.filter(i => i.status === 'Overdue')

  const factors: ClientHealth['factors'] = []

  if (closedWon.length > 0) { score += 15; factors.push({ label: 'Active deals closed', impact: 'positive' }) }
  if (totalValue > 10000) { score += 10; factors.push({ label: `${formatCurrency(totalValue)} total deal value`, impact: 'positive' }) }

  if (renewalDays !== null && renewalDays <= 30) { score -= 15; factors.push({ label: `Renewal in ${renewalDays} days`, impact: 'negative' }) }
  else if (renewalDays !== null && renewalDays <= 90) { score -= 5; factors.push({ label: `Renewal in ${renewalDays} days`, impact: 'neutral' }) }
  else if (nextRenewal?.status === 'Renewed') { score += 10; factors.push({ label: 'Recently renewed', impact: 'positive' }) }

  if (openTickets >= 3) { score -= 20; factors.push({ label: `${openTickets} open tickets`, impact: 'negative' }) }
  else if (openTickets > 0) { score -= 5; factors.push({ label: `${openTickets} open ticket(s)`, impact: 'neutral' }) }
  else { score += 5; factors.push({ label: 'No open tickets', impact: 'positive' }) }

  if (overdueInvoices.length > 0) { score -= 15; factors.push({ label: `${overdueInvoices.length} overdue invoice(s)`, impact: 'negative' }) }

  if (company.lastActivity) {
    const daysSince = Math.round((Date.now() - new Date(company.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince > 60) { score -= 10; factors.push({ label: `No activity in ${daysSince} days`, impact: 'negative' }) }
    else if (daysSince < 14) { score += 10; factors.push({ label: 'Recent engagement', impact: 'positive' }) }
  }

  score = Math.max(0, Math.min(100, score))

  let healthLabel: ClientHealth['healthLabel'] = 'Green'
  let healthColor = '#22c55e'
  if (score < 40) { healthLabel = 'Red'; healthColor = '#ef4444' }
  else if (score < 65) { healthLabel = 'Yellow'; healthColor = '#f59e0b' }

  return {
    id: company.id,
    name: company.name,
    status: company.status,
    healthScore: score,
    healthLabel,
    healthColor,
    totalDealValue: totalValue,
    openTickets,
    renewalDays,
    lastActivity: company.lastActivity || company.createdDate,
    factors,
  }
}

export default function ClientHealthPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('90D')
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('All')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CRMCompany[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // AUDIT.md #206 — raw fetch()es against 100-row-cursor-paginated routes
  // silently truncated Health scores/factors past that (same bug class as
  // #48/#151); fetchAllPages() follows the cursor to completion instead.
  function loadData() {
    setLoading(true)
    Promise.all([
      fetchAllPages<CRMCompany>('/api/crm/companies'),
      fetchAllPages<Deal>('/api/deals'),
      fetchAllPages<Renewal>('/api/renewals'),
      fetchAllPages<Invoice>('/api/invoices'),
      fetchAllPages<TicketRow>('/api/tickets'),
    ]).then(([c, d, r, i, t]) => {
      if (Array.isArray(c)) setCompanies(c)
      if (Array.isArray(d)) setDeals(d)
      if (Array.isArray(r)) setRenewals(r)
      if (Array.isArray(i)) setInvoices(i)
      if (Array.isArray(t)) setTickets(t)
    }).catch(() => toast('Failed to load client health data', 'error'))
      .finally(() => setLoading(false))
  }

  // loadData() is also wired to the refresh button below, so its own
  // setLoading(true) must stay.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [])

  const clientHealth = useMemo(() => {
    let cutoffISO: string
    let endISO: string
    if (dateRange === 'Custom') {
      cutoffISO = customStart || '1970-01-01'
      endISO = customEnd ? customEnd + 'T23:59:59.999Z' : new Date().toISOString()
    } else {
      const now = new Date()
      const cutoff = new Date(now)
      if (dateRange === '30D') cutoff.setDate(cutoff.getDate() - 30)
      else if (dateRange === '90D') cutoff.setDate(cutoff.getDate() - 90)
      else cutoff.setFullYear(cutoff.getFullYear() - 1)
      cutoffISO = cutoff.toISOString()
      endISO = now.toISOString()
    }

    const filteredDeals = deals.filter(d => {
      const date = d.closeDate || d.lastActivity
      return !date || (date >= cutoffISO && date <= endISO)
    })
    const filteredInvoices = invoices.filter(i => {
      return !i.issuedDate || (i.issuedDate >= cutoffISO && i.issuedDate <= endISO)
    })
    const filteredTickets = tickets.filter(t => {
      return !t.created_at || (t.created_at >= cutoffISO && t.created_at <= endISO)
    })

    return companies
      .filter(c => c.status === 'Active Client' || c.status === 'Partner')
      .map(c => computeHealth(c, filteredDeals, renewals, filteredInvoices, filteredTickets))
      .sort((a, b) => a.healthScore - b.healthScore)
  }, [companies, deals, renewals, invoices, tickets, dateRange, customStart, customEnd])

  const filtered = healthFilter === 'All' ? clientHealth : clientHealth.filter(c => c.healthLabel === healthFilter)

  const healthCounts = useMemo(() => ({
    green: clientHealth.filter(c => c.healthLabel === 'Green').length,
    yellow: clientHealth.filter(c => c.healthLabel === 'Yellow').length,
    red: clientHealth.filter(c => c.healthLabel === 'Red').length,
  }), [clientHealth])

  const upcomingRenewals = useMemo(() => {
    return renewals
      .filter(r => r.daysUntilExpiry > 0 && r.daysUntilExpiry <= 90)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
      .slice(0, 10)
  }, [renewals])

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header title="Client Health" subtitle="Client engagement scores, risk factors, and renewal timeline" />
      <div className="page-content">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period:</span>
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
              {(['30D', '90D', '12M', 'Custom'] as DateRange[]).map(r => (
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
            {dateRange === 'Custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700" />
                <span className="text-xs text-gray-400">to</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status:</span>
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
              {(['All', 'Red', 'Yellow', 'Green'] as HealthFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setHealthFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${healthFilter === f ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                  style={{ background: healthFilter === f ? (f === 'Red' ? '#ef4444' : f === 'Yellow' ? '#f59e0b' : f === 'Green' ? '#22c55e' : '#015035') : undefined }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="kpi-card">
            <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{clientHealth.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#015035' }}>Active Clients</p>
          </div>
          <div className="kpi-card">
            <p className="text-2xl font-bold mb-0.5 tracking-tight" style={{ color: '#22c55e' }}>{healthCounts.green}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600">Healthy</p>
          </div>
          <div className="kpi-card">
            <p className="text-2xl font-bold mb-0.5 tracking-tight" style={{ color: '#f59e0b' }}>{healthCounts.yellow}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-600">At Risk</p>
          </div>
          <div className="kpi-card">
            <p className="text-2xl font-bold mb-0.5 tracking-tight" style={{ color: '#ef4444' }}>{healthCounts.red}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-600">Needs Attention</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Client Health Scores</h3>
            <div className="flex flex-col gap-2">
              {filtered.map(client => (
                <div key={client.id}>
                  <button
                    onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: client.healthColor }} />
                    <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{client.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${client.healthScore}%`, background: client.healthColor }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: client.healthColor }}>{client.healthScore}</span>
                    </div>
                  </button>
                  {expandedClient === client.id && (
                    <div className="ml-9 mr-3 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Deal Value</p>
                          <p className="text-sm font-bold" style={{ color: '#015035' }}>{formatCurrency(client.totalDealValue)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Open Tickets</p>
                          <p className="text-sm font-bold text-gray-800">{client.openTickets}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase">Renewal</p>
                          <p className="text-sm font-bold text-gray-800">{client.renewalDays !== null ? `${client.renewalDays}d` : 'N/A'}</p>
                        </div>
                      </div>
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Factors</h4>
                      <div className="flex flex-col gap-1">
                        {client.factors.map((f, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.impact === 'positive' ? 'bg-green-500' : f.impact === 'negative' ? 'bg-red-500' : 'bg-yellow-400'}`} />
                            <span className="text-xs text-gray-600">{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No clients match the current filter</p>
              )}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Renewal Timeline</h3>
            <div className="flex flex-col gap-2">
              {upcomingRenewals.map(r => {
                const urgency = r.daysUntilExpiry <= 14 ? '#ef4444' : r.daysUntilExpiry <= 30 ? '#f59e0b' : '#22c55e'
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.company}</p>
                      <p className="text-[10px] text-gray-400">{formatCurrency(r.renewalValue)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-2 h-2 rounded-full" style={{ background: urgency }} />
                      <span className="text-xs font-bold" style={{ color: urgency }}>{r.daysUntilExpiry}d</span>
                    </div>
                  </div>
                )
              })}
              {upcomingRenewals.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No upcoming renewals</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
