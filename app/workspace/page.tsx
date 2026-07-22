'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import type { AppTask, Deal } from '@/lib/types'
import {
  CheckSquare, Mail, Zap, TrendingUp, ChevronRight, AlertTriangle,
  Calendar, Users as UsersIcon,
} from 'lucide-react'

interface GuidedAction {
  id: string
  title: string
  detail: string
  href: string
  urgent: boolean
}

interface RepActivity {
  activeEnrollments: number
  sent: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  totalActivities: number
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

export default function WorkspacePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<AppTask[]>([])
  const [guidedActions, setGuidedActions] = useState<GuidedAction[]>([])
  const [repActivity, setRepActivity] = useState<RepActivity | null>(null)
  const [myDeals, setMyDeals] = useState<Deal[]>([])

  useEffect(() => {
    if (!user?.name) return
    Promise.all([
      // AUDIT #290 — raw fetch() against a route cursor-paginated at 100
      // rows; a rep with more than 100 pending tasks would silently lose
      // some off the end. Realistically stays under 100 per person, but
      // matching the fetchAllPages() convention this page already uses
      // for deals.
      fetchAllPages<AppTask>(`/api/tasks?assignedTo=${encodeURIComponent(user.name)}&status=Pending`).catch(() => []),
      fetch('/api/workspace/guided-actions').then(r => r.ok ? r.json() : []),
      fetch('/api/sequences/rep-activity').then(r => r.ok ? r.json() : null),
      fetchAllPages<Deal>('/api/deals'),
    ])
      .then(([taskData, actionData, activityData, dealData]) => {
        if (Array.isArray(taskData)) setTasks(taskData)
        if (Array.isArray(actionData)) setGuidedActions(actionData)
        setRepActivity(activityData)
        setMyDeals(dealData.filter((d: Deal) => d.assignedRep === user.name))
      })
      .catch(() => toast('Failed to load workspace', 'error'))
      .finally(() => setLoading(false))
  }, [user?.name, toast])

  const today = getToday()
  const tasksDueToday = tasks.filter(t => t.dueDate === today)
  const highPriorityTasks = tasks.filter(t => t.priority === 'High')

  // Matches the Pipeline page's closed-stage detection (startsWith, not an
  // exact match) so a custom stage name like "Closed — Duplicate" doesn't
  // count as open here but closed there.
  const openDeals = myDeals.filter(d => !d.stage.startsWith('Closed'))
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const wonThisMonth = myDeals.filter(d => d.stage === 'Closed Won' && d.closeDate?.startsWith(thisMonth))
  const wonValueThisMonth = wonThisMonth.reduce((s, d) => s + d.value, 0)

  const scoredDeals = [...openDeals]
    .filter(d => typeof d.dealScore === 'number')
    .sort((a, b) => (a.dealScore ?? 0) - (b.dealScore ?? 0))
    .slice(0, 5)

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header title="My Workspace" subtitle={`Good to see you, ${user?.name?.split(' ')[0] ?? ''}`} />
      <div className="p-4 md:p-6 flex flex-col gap-4 bg-[#faf9f6] flex-1">

        {/* Top stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare size={15} style={{ color: '#015035' }} />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Tasks</p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{tasksDueToday.length}</p>
                <p className="text-[11px] text-gray-400">Due today</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500" style={{ fontFamily: 'var(--font-heading)' }}>{highPriorityTasks.length}</p>
                <p className="text-[11px] text-gray-400">High priority</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{tasks.length}</p>
                <p className="text-[11px] text-gray-400">All open</p>
              </div>
            </div>
            <Link href="/tasks" className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: '#015035' }}>
              View tasks <ChevronRight size={12} />
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={15} style={{ color: '#015035' }} />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outreach Today</p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{repActivity?.sent ?? 0}</p>
                <p className="text-[11px] text-gray-400">Sent</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{repActivity?.opened ?? 0}</p>
                <p className="text-[11px] text-gray-400">Opened</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600" style={{ fontFamily: 'var(--font-heading)' }}>{repActivity?.replied ?? 0}</p>
                <p className="text-[11px] text-gray-400">Replied</p>
              </div>
            </div>
            <Link href="/crm/sequences" className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: '#015035' }}>
              {repActivity?.activeEnrollments ?? 0} active enrollments <ChevronRight size={12} />
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} style={{ color: '#015035' }} />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Pipeline</p>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#015035' }}>{formatCurrency(pipelineValue)}</p>
                <p className="text-[11px] text-gray-400">{openDeals.length} open deals</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'var(--font-heading)' }}>{formatCurrency(wonValueThisMonth)}</p>
                <p className="text-[11px] text-gray-400">{wonThisMonth.length} won this month</p>
              </div>
            </div>
            <Link href="/crm/pipeline" className="text-xs font-semibold mt-3 inline-flex items-center gap-1" style={{ color: '#015035' }}>
              View pipeline <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Guided actions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} style={{ color: '#CC7853' }} />
              <h3 className="text-sm font-bold text-gray-800">Guided Actions</h3>
            </div>
            {guidedActions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nothing needs your attention right now.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {guidedActions.map(a => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    {a.urgent
                      ? <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      : <Calendar size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Deal score highlights */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <UsersIcon size={15} style={{ color: '#015035' }} />
              <h3 className="text-sm font-bold text-gray-800">Deals Needing Attention</h3>
            </div>
            {scoredDeals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No open deals with a score yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {scoredDeals.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.company}</p>
                      <p className="text-xs text-gray-400">{formatCurrency(d.value)} · {d.stage}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                      (d.dealScore ?? 0) >= 60 ? 'bg-emerald-50 text-emerald-700' : (d.dealScore ?? 0) >= 35 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>{d.dealScore}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
