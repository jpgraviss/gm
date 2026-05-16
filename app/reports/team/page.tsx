'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { fetchTeamMembers } from '@/lib/supabase'
import type { TeamMember, AppTask, TimeEntry } from '@/lib/types'

type DateRange = '7D' | '30D' | '90D'

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

  useEffect(() => {
    Promise.all([
      fetchTeamMembers(),
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/time-entries').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
      fetch('/api/tickets').then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d : d?.data ?? []),
    ]).then(([tm, t, te, tk]) => {
      if (Array.isArray(tm)) setTeamMembers(tm)
      if (Array.isArray(t)) setTasks(t)
      if (Array.isArray(te)) setTimeEntries(te)
      if (Array.isArray(tk)) setTickets(tk)
    }).catch(() => toast('Failed to load team data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const cutoffDate = useMemo(() => {
    const d = new Date()
    if (dateRange === '7D') d.setDate(d.getDate() - 7)
    else if (dateRange === '30D') d.setDate(d.getDate() - 30)
    else d.setDate(d.getDate() - 90)
    return d.toISOString()
  }, [dateRange])

  const memberStats = useMemo(() => {
    return teamMembers.map(m => {
      const memberTasks = tasks.filter(t => t.assignedTo === m.name)
      const completedTasks = memberTasks.filter(t => t.status === 'Completed' && (t.completedDate ?? '') >= cutoffDate)
      const memberTime = timeEntries.filter(t => t.teamMember === m.name && t.date >= cutoffDate)
      const totalHours = memberTime.reduce((s, t) => s + t.hours + t.minutes / 60, 0)
      const memberTickets = tickets.filter(t => t.assignee === m.name)
      const resolvedTickets = memberTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed')

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
        score: completedTasks.length * 3 + Math.round(totalHours) + resolvedTickets.length * 2,
      }
    }).sort((a, b) => b.score - a.score)
  }, [teamMembers, tasks, timeEntries, tickets, cutoffDate])

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Team Productivity" subtitle="Performance metrics, leaderboard, and activity timeline" />
      <div className="page-content">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Period:</span>
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
              {(['7D', '30D', '90D'] as DateRange[]).map(r => (
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Tasks Completed', value: filteredStats.reduce((s, m) => s + m.tasksCompleted, 0).toString(), color: '#015035' },
            { label: 'Hours Tracked', value: filteredStats.reduce((s, m) => s + m.hoursTracked, 0).toFixed(1), color: '#3b82f6' },
            { label: 'Tickets Resolved', value: filteredStats.reduce((s, m) => s + m.ticketsResolved, 0).toString(), color: '#22c55e' },
            { label: 'Team Members', value: teamMembers.length.toString(), color: '#8b5cf6' },
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
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Member</th>
                    <th className="text-right pb-2 font-semibold">Tasks</th>
                    <th className="text-right pb-2 font-semibold">Hours</th>
                    <th className="text-right pb-2 font-semibold">Tickets</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
