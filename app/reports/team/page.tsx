'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { useToast } from '@/components/ui/Toast'
import { fetchTeamMembers } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
import { computeMRR, contractMonthlyValue, RECURRING_STATUSES } from '@/lib/metrics'
import type { TeamMember, AppTask, TimeEntry, Contract, Deal } from '@/lib/types'

type DateRange = '7D' | '30D' | '90D' | 'Custom'

interface TicketRow {
  id: string
  assignee: string
  status: string
  created_at?: string
  resolved_at?: string
}

export default function TeamProductivityPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('30D')
  const [selectedMember, setSelectedMember] = useState('All')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  function loadData() {
    setLoading(true)
    Promise.all([
      fetchTeamMembers(),
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/time-entries').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/tickets').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/contracts').then(r => r.ok ? r.json() : []),
      fetch('/api/deals').then(r => r.ok ? r.json() : []),
    ]).then(([tm, t, te, tk, con, dl]) => {
      if (Array.isArray(tm)) setTeamMembers(tm)
      if (Array.isArray(t)) setTasks(t)
      if (Array.isArray(te)) setTimeEntries(te)
      if (Array.isArray(tk)) setTickets(tk)
      if (Array.isArray(con)) setContracts(con)
      if (Array.isArray(dl)) setDeals(dl)
    }).catch(() => toast('Failed to load team data', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const cutoffDate = useMemo(() => {
    if (dateRange === 'Custom') return customStart || '1970-01-01'
    const d = new Date()
    if (dateRange === '7D') d.setDate(d.getDate() - 7)
    else if (dateRange === '30D') d.setDate(d.getDate() - 30)
    else d.setDate(d.getDate() - 90)
    return d.toISOString()
  }, [dateRange, customStart])

  const cutoffEnd = useMemo(() => {
    if (dateRange === 'Custom' && customEnd) return customEnd + 'T23:59:59.999Z'
    return new Date().toISOString()
  }, [dateRange, customEnd])

  const memberStats = useMemo(() => {
    return teamMembers.map(m => {
      const memberTasks = tasks.filter(t => t.assignedTo === m.name)
      const completedTasks = memberTasks.filter(t => t.status === 'Completed' && (t.completedDate ?? '') >= cutoffDate && (t.completedDate ?? '') <= cutoffEnd)
      const memberTime = timeEntries.filter(t => t.teamMember === m.name && t.date >= cutoffDate && t.date <= cutoffEnd)
      const totalHours = memberTime.reduce((s, t) => s + t.hours + t.minutes / 60, 0)
      const memberTickets = tickets.filter(t => t.assignee === m.name)
      const resolvedTickets = memberTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed')

      // Revenue: deals where this member is the assigned rep, within date range
      const memberDeals = deals.filter(d => d.assignedRep === m.name && d.stage === 'Closed Won')
      const filteredMemberDeals = memberDeals.filter(d => {
        const date = d.closeDate || d.lastActivity
        return !date || (date >= cutoffDate && date <= cutoffEnd)
      })
      const dealRevenue = filteredMemberDeals.reduce((s, d) => s + d.value, 0)

      // MRR: contracts where this member is the assigned rep
      const memberContracts = contracts.filter(c => c.assignedRep === m.name && RECURRING_STATUSES.includes(c.status))
      const memberMRR = memberContracts.reduce((s, c) => s + contractMonthlyValue(c), 0)

      return {
        id: m.id,
        name: m.name,
        initials: m.initials,
        role: m.role,
        tasksCompleted: completedTasks.length,
        totalTasks: memberTasks.length,
        hoursTracked: Math.round(totalHours * 10) / 10,
        ticketsResolved: resolvedTickets.length,
        totalTickets: memberTickets.length,
        dealRevenue,
        memberMRR,
        score: completedTasks.length * 3 + Math.round(totalHours) + resolvedTickets.length * 2,
      }
    }).sort((a, b) => b.score - a.score)
  }, [teamMembers, tasks, timeEntries, tickets, contracts, deals, cutoffDate, cutoffEnd])

  const filteredStats = selectedMember === 'All' ? memberStats : memberStats.filter(m => m.name === selectedMember)
  const maxScore = Math.max(...memberStats.map(m => m.score), 1)

  const recentActivity = useMemo(() => {
    const items: Array<{ id: string; user: string; action: string; date: string }> = []

    tasks.filter(t => t.status === 'Completed' && t.completedDate).forEach(t => {
      items.push({ id: `t-${t.id}`, user: t.assignedTo, action: `Completed task "${t.title}"`, date: t.completedDate! })
    })

    timeEntries.filter(t => t.date >= cutoffDate).forEach(t => {
      items.push({ id: `te-${t.id}`, user: t.teamMember, action: `Logged ${t.hours}h ${t.minutes}m${t.projectName ? ` on ${t.projectName}` : ''}`, date: t.date })
    })

    return items
      .filter(i => selectedMember === 'All' || i.user === selectedMember)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
  }, [tasks, timeEntries, cutoffDate, selectedMember])

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header title="Team Productivity" subtitle="Performance metrics, leaderboard, and activity timeline" />
      <div className="page-content">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period:</span>
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
              {(['7D', '30D', '90D', 'Custom'] as DateRange[]).map(r => (
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
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Member:</span>
            <select
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-green-700"
            >
              <option value="All">All Members</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          </div>
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Tasks Completed', value: filteredStats.reduce((s, m) => s + m.tasksCompleted, 0).toString(), color: '#015035' },
            { label: 'Hours Tracked', value: filteredStats.reduce((s, m) => s + m.hoursTracked, 0).toFixed(1), color: '#3b82f6' },
            { label: 'Tickets Resolved', value: filteredStats.reduce((s, m) => s + m.ticketsResolved, 0).toString(), color: '#22c55e' },
            { label: 'Deal Revenue', value: formatCurrency(filteredStats.reduce((s, m) => s + m.dealRevenue, 0)), color: '#f59e0b' },
            { label: 'Team MRR', value: formatCurrency(filteredStats.reduce((s, m) => s + m.memberMRR, 0)), color: '#8b5cf6' },
            { label: 'Team Members', value: teamMembers.length.toString(), color: '#9ca3af' },
          ].map(m => (
            <div key={m.label} className="kpi-card">
              <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{m.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: m.color }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Leaderboard</h3>
            <div className="flex flex-col gap-3">
              {memberStats.slice(0, 10).map((m, idx) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-right">{idx + 1}</span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#015035' }}
                  >
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                      <span className="text-xs font-bold text-gray-700 ml-2">{m.score} pts</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(m.score / maxScore) * 100}%`, background: '#015035' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-4">Per-Member Metrics</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Member</th>
                    <th className="text-right pb-2 font-semibold">Tasks</th>
                    <th className="text-right pb-2 font-semibold">Hours</th>
                    <th className="text-right pb-2 font-semibold">Tickets</th>
                    <th className="text-right pb-2 font-semibold">Deal Rev</th>
                    <th className="text-right pb-2 font-semibold">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                            {m.initials}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{m.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-sm text-right font-semibold text-gray-700">{m.tasksCompleted}/{m.totalTasks}</td>
                      <td className="py-2 text-sm text-right font-semibold text-gray-700">{m.hoursTracked}h</td>
                      <td className="py-2 text-sm text-right font-semibold text-gray-700">{m.ticketsResolved}/{m.totalTickets}</td>
                      <td className="py-2 text-sm text-right font-bold" style={{ color: '#015035' }}>{formatCurrency(m.dealRevenue)}</td>
                      <td className="py-2 text-sm text-right font-bold" style={{ color: '#8b5cf6' }}>{formatCurrency(m.memberMRR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="metric-card mb-6">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Per-Member Revenue Breakdown</h3>
          <div className="flex flex-col gap-3">
            {filteredStats
              .filter(m => m.dealRevenue > 0 || m.memberMRR > 0)
              .sort((a, b) => (b.dealRevenue + b.memberMRR * 12) - (a.dealRevenue + a.memberMRR * 12))
              .map(m => {
                const totalAnnual = m.dealRevenue + m.memberMRR * 12
                const maxAnnual = Math.max(...filteredStats.map(s => s.dealRevenue + s.memberMRR * 12), 1)
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#015035' }}>
                        {m.initials}
                      </div>
                      <span className="text-xs font-medium text-gray-800 truncate">{m.name}</span>
                    </div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                      <div
                        className="h-full"
                        style={{ width: `${maxAnnual > 0 ? (m.dealRevenue / maxAnnual) * 100 : 0}%`, background: '#015035' }}
                        title={`Deal revenue: ${formatCurrency(m.dealRevenue)}`}
                      />
                      <div
                        className="h-full"
                        style={{ width: `${maxAnnual > 0 ? ((m.memberMRR * 12) / maxAnnual) * 100 : 0}%`, background: '#8b5cf6' }}
                        title={`Recurring (annualized): ${formatCurrency(m.memberMRR * 12)}`}
                      />
                    </div>
                    <div className="flex-shrink-0 text-right w-28">
                      <span className="text-xs font-bold text-gray-800">{formatCurrency(totalAnnual)}</span>
                      <span className="text-[10px] text-gray-400 ml-1">total</span>
                    </div>
                  </div>
                )
              })}
            {filteredStats.filter(m => m.dealRevenue > 0 || m.memberMRR > 0).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No revenue attributed to team members in this period</p>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#015035' }} /><span className="text-[10px] text-gray-500">Deal Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: '#8b5cf6' }} /><span className="text-[10px] text-gray-500">Recurring (Annualized)</span></div>
          </div>
        </div>

        <div className="metric-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">Activity Timeline</h3>
          <div className="flex flex-col">
            {recentActivity.map((a, idx) => (
              <div key={a.id} className="flex gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#015035' }} />
                  {idx < recentActivity.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-sm text-gray-800"><span className="font-semibold">{a.user}</span> {a.action}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
