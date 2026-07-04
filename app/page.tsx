'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { useSettings } from '@/lib/useSettings'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, CheckCircle, RefreshCw,
  FolderKanban, Calendar, ArrowUpRight, ArrowRight,
  FileText, ScrollText, AlertCircle, Zap,
  Wrench, MessageSquare, CheckSquare, Clock,
  ChevronDown, Mail, Send, Eye, BarChart3, Target,
  Briefcase, Users, Brain, Sparkles,
} from 'lucide-react'
import { formatCurrency, contractStatusColors, invoiceStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { RevenueMonth } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'

// ─── Greeting ─────────────────────────────────────────────────────────────────

interface Greeting { headline: string; sub: string; emoji: string }

const ROTATING_MESSAGES: { sub: string; emoji: string }[] = [
  { sub: 'Revenue doesn\'t sleep. Neither does GravHub.',             emoji: '🔥' },
  { sub: 'Every deal in your pipeline is a future payday.',           emoji: '💰' },
  { sub: 'Outwork yesterday. Outclose tomorrow.',                     emoji: '🚀' },
  { sub: 'Your pipeline is your paycheck — keep it full.',            emoji: '📈' },
  { sub: 'Closed is the only stage that pays.',                       emoji: '🎯' },
  { sub: 'Speed to lead. Speed to close. Speed to invoice.',          emoji: '⚡' },
  { sub: 'The follow-up you skip is the deal you lose.',              emoji: '📞' },
  { sub: 'A stale pipeline is a broke pipeline.',                     emoji: '💀' },
  { sub: 'Renewals are revenue you already earned. Go collect.',      emoji: '💎' },
  { sub: 'You\'re not just selling — you\'re building an empire.',    emoji: '👑' },
  { sub: 'The difference between good and great? One more follow-up.',emoji: '💪' },
  { sub: 'Opportunities don\'t expire — but your competitors don\'t wait.', emoji: '⏳' },
  { sub: 'Today\'s proposal is next month\'s revenue.',               emoji: '📝' },
  { sub: 'Track everything. Miss nothing. Close more.',               emoji: '🔒' },
  { sub: 'Your CRM is only as strong as the reps using it.',          emoji: '🏋️' },
]

function buildGreeting(firstName: string, now: Date, greetings?: { morning: string; afternoon: string; evening: string; night: string }): Greeting {
  const hour = now.getHours()
  const g = greetings ?? { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening', night: 'Burning the midnight oil' }

  const timePrefix =
    hour >= 5  && hour < 12 ? g.morning    :
    hour >= 12 && hour < 17 ? g.afternoon  :
    hour >= 17 && hour < 23 ? g.evening    :
    g.night

  return { headline: `${timePrefix}, ${firstName}!`, sub: '', emoji: '' }
}

function GreetingBanner({ name }: { name: string }) {
  const settings = useSettings()
  const messages = settings?.dashboard.rotatingMessages ?? ROTATING_MESSAGES
  const firstName = name.split(' ')[0]
  const [visible, setVisible]   = useState(false)
  const [headline, setHeadline] = useState('')
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * messages.length))
  const [fade, setFade]         = useState(true)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gravhub_login_at')
      if (!raw) return
      const loginAt = parseInt(raw, 10)
      const elapsed = Date.now() - loginAt
      const THREE_MIN = 3 * 60 * 1000
      if (elapsed >= THREE_MIN) return
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeadline(buildGreeting(firstName, new Date(), settings?.dashboard.greetings).headline)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
      const hideTimer = setTimeout(() => setVisible(false), THREE_MIN - elapsed)
      return () => clearTimeout(hideTimer)
    } catch {/* ignore */}
  }, [firstName])

  // Rotate sub-message every 30 seconds
  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIndex(prev => (prev + 1) % messages.length)
        setFade(true)
      }, 300)
    }, 30_000)
    return () => clearInterval(interval)
  }, [visible, messages.length])

  if (!visible) return null

  const currentMsg = messages[msgIndex] ?? messages[0]

  return (
    <div
      className="rounded-xl px-6 py-4 flex items-center justify-between"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
        border: '1px solid #d1fae5',
        borderLeft: '4px solid #015035',
      }}
    >
      <div>
        <p style={{ fontSize: '22px', fontWeight: 800, color: '#111827', lineHeight: 1.25, margin: 0 }}>
          {headline}
        </p>
        <p
          style={{
            fontSize: '13px', color: '#6b7280', marginTop: '4px', marginBottom: 0,
            transition: 'opacity 0.3s ease',
            opacity: fade ? 1 : 0,
          }}
        >
          {currentMsg.sub}
        </p>
      </div>
      <span
        style={{
          fontSize: '48px', lineHeight: 1, userSelect: 'none',
          transition: 'opacity 0.3s ease',
          opacity: fade ? 1 : 0,
        }}
        aria-hidden
      >
        {currentMsg.emoji}
      </span>
    </div>
  )
}

// ─── Magic Moment Toast (11:11 · 4:44) ────────────────────────────────────────

function MagicMomentToast({ name }: { name: string }) {
  const firstName = name.split(' ')[0]
  const [moment, setMoment] = useState<null | '11:11' | '4:44'>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function check() {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      if ((h === 11 || h === 23) && m === 11) {
        setMoment('11:11')
        setVisible(true)
      } else if ((h === 4 || h === 16) && m === 44) {
        setMoment('4:44')
        setVisible(true)
      } else {
        setVisible(false)
      }
    }
    check()
    const id = setInterval(check, 10_000) // check every 10s
    return () => clearInterval(id)
  }, [])

  if (!visible || !moment) return null

  const is1111 = moment === '11:11'

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden"
      style={{
        background: is1111
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0d1f3c 100%)'
          : 'linear-gradient(135deg, #0a0a0a 0%, #1c1000 50%, #3d1a00 100%)',
        border: is1111 ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(245,158,11,0.4)',
        boxShadow: is1111
          ? '0 0 40px rgba(168,85,247,0.25), 0 20px 60px rgba(0,0,0,0.5)'
          : '0 0 40px rgba(245,158,11,0.25), 0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      {/* Shimmer line */}
      <div
        className="h-0.5 w-full"
        style={{
          background: is1111
            ? 'linear-gradient(90deg, transparent, #a855f7, #ec4899, #a855f7, transparent)'
            : 'linear-gradient(90deg, transparent, #f59e0b, #fbbf24, #f59e0b, transparent)',
        }}
      />

      <div className="p-5">
        {is1111 ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: '28px' }}>✨</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{ color: '#a855f7' }}>
                  11:11 · Make A Wish
                </p>
                <p className="text-white text-lg font-bold leading-tight">
                  Make A Wish, {firstName}!
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              The universe just aligned for you. 11:11 is your reminder that what you focus on, you attract — so dream boldly, {firstName}. Exciting times are ahead. 🚀
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {['✨','⭐','✨','⭐','✨'].map((s, i) => (
                <span key={i} style={{ fontSize: '14px', opacity: 0.6 + i * 0.1 }}>{s}</span>
              ))}
              <span className="text-[10px] font-semibold ml-1" style={{ color: 'rgba(168,85,247,0.8)' }}>EXCITING TIMES</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: '28px' }}>👑</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-0.5" style={{ color: '#f59e0b' }}>
                  4:44 · Keep Building
                </p>
                <p className="text-white text-lg font-bold leading-tight">
                  444 — Foundation Time, {firstName}.
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              4:44 is the angel number of hustle, legacy, and building something that lasts. You&apos;re not just working — you&apos;re laying the foundation. Stay locked in. 💎
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {['🔥','💎','🔥','💎','🔥'].map((s, i) => (
                <span key={i} style={{ fontSize: '14px', opacity: 0.6 + i * 0.1 }}>{s}</span>
              ))}
              <span className="text-[10px] font-semibold ml-1" style={{ color: 'rgba(245,158,11,0.8)' }}>STAY LOCKED IN</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent, trend, href,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string; trend?: string; href?: string
}) {
  const inner = (
    <div className={`kpi-card h-full${href ? ' hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer' : ''}`} style={{ '--kpi-accent': accent } as React.CSSProperties}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}15` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <ArrowUpRight size={11} />{trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-0.5 tracking-tight">{value}</p>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

// ─── Revenue Bar Chart ────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: RevenueMonth[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-36 text-sm text-gray-400">No revenue data yet</div>
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="flex items-end gap-2 h-36">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="w-full">
            <div
              className="w-full rounded-t-md group-hover:opacity-85 transition-opacity"
              style={{ height: `${Math.max(0, (d.revenue - d.recurring) / max) * 112}px`, background: '#015035' }}
              title={`One-time: ${formatCurrency(d.revenue - d.recurring)}`}
            />
            <div
              className="w-full rounded-b-sm"
              style={{ height: `${(d.recurring / max) * 112}px`, background: '#d1fae5', borderTop: '1px solid #a7f3d0' }}
              title={`Recurring: ${formatCurrency(d.recurring)}`}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Activity icons ───────────────────────────────────────────────────────────

const activityMeta: Record<string, { icon: React.ReactNode; color: string }> = {
  deal:     { icon: <TrendingUp size={13} />,  color: '#3b82f6' },
  contract: { icon: <ScrollText size={13} />,  color: '#015035' },
  invoice:  { icon: <DollarSign size={13} />,  color: '#22c55e' },
  proposal: { icon: <FileText size={13} />,    color: '#f59e0b' },
  project:  { icon: <FolderKanban size={13} />,color: '#8b5cf6' },
  task:     { icon: <CheckCircle size={13} />, color: '#14b8a6' },
  action:   { icon: <CheckCircle size={13} />, color: '#9ca3af' },
  info:     { icon: <AlertCircle size={13} />, color: '#3b82f6' },
  success:  { icon: <CheckCircle size={13} />, color: '#22c55e' },
  warning:  { icon: <AlertCircle size={13} />, color: '#f59e0b' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  metrics: {
    activeClients: number
    openDeals: number
    pipelineValue: number
    totalCollected: number
    overdueInvoices: number
    upcomingRenewals: number
    totalInvoiced: number
    totalOverdue: number
    totalPending: number
    winRate: number
    avgDealSize: number
    totalDealValue: number
    deals30d: number
    contracts30d: number
    invoices30d: number
  }
  recentDeals: Array<{ id: string; company: string; stage: string; value: number; serviceType: string; lastActivity: string }>
  recentContracts: Array<{ id: string; company: string; status: string; value: number; renewalDate: string; serviceType: string }>
  recentInvoices: Array<{ id: string; company: string; amount: number; status: string; dueDate: string; serviceType: string; contractId: string }>
  activityFeed: Array<{ id: string; user: string; action: string; module: string; type: string; timestamp: string }>
  revenueByMonth: RevenueMonth[]
  automations: Array<{ name: string; status: string; runs: number }>
}

const emptyData: DashboardData = {
  metrics: { activeClients: 0, openDeals: 0, pipelineValue: 0, totalCollected: 0, overdueInvoices: 0, upcomingRenewals: 0, totalInvoiced: 0, totalOverdue: 0, totalPending: 0, winRate: 0, avgDealSize: 0, totalDealValue: 0, deals30d: 0, contracts30d: 0, invoices30d: 0 },
  recentDeals: [],
  recentContracts: [],
  recentInvoices: [],
  activityFeed: [],
  revenueByMonth: [],
  automations: [],
}

// ─── Live ET Clock ────────────────────────────────────────────────────────────

const ET_LOCALE  = 'en-US'
const ET_TZ      = 'America/New_York'
const WEEK_DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getNowET(): Date {
  // Returns a Date whose local values (getHours, etc.) reflect ET
  const etString = new Date().toLocaleString(ET_LOCALE, { timeZone: ET_TZ })
  return new Date(etString)
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(getNowET())
    const id = setInterval(() => setNow(getNowET()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const dayName  = WEEK_DAYS[now.getDay()]
  const month    = MONTHS[now.getMonth()]
  const date     = now.getDate()
  const year     = now.getFullYear()
  const week     = getWeekNumber(now)
  const h        = now.getHours()
  const m        = now.getMinutes()
  const s        = now.getSeconds()
  const ampm     = h >= 12 ? 'PM' : 'AM'
  const h12      = h % 12 || 12
  const mm       = String(m).padStart(2, '0')
  const ss       = String(s).padStart(2, '0')
  const suffix   = (date >= 11 && date <= 13) ? 'th' : date % 10 === 1 ? 'st' : date % 10 === 2 ? 'nd' : date % 10 === 3 ? 'rd' : 'th'

  return (
    <div
      className="rounded-xl px-5 py-3 flex items-center justify-between"
      style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
    >
      {/* Date block */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
          {dayName}, {month} {date}{suffix}, {year}
        </span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Week {week}</span>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Q{Math.ceil((now.getMonth() + 1) / 3)}</span>
      </div>
      {/* Live time */}
      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#015035', fontVariantNumeric: 'tabular-nums' }}>
          {h12}:{mm}:{ss}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{ampm}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '2px' }}>ET</span>
      </div>
    </div>
  )
}

// ─── Contractor Dashboard ────────────────────────────────────────────────────

interface ContractorProject { id: string; company: string; serviceType: string; status: string; progress: number; launchDate: string }
interface ContractorTicket { id: string; subject: string; company: string; status: string; priority: string; created_at: string }
interface ContractorTask { id: string; title: string; status: string; assignee: string; due_date: string; project_id?: string }

function ContractorDashboard({ userName }: { userName: string }) {
  const { toast } = useToast()
  const [projects, setProjects] = useState<ContractorProject[]>([])
  const [tasks, setTasks] = useState<ContractorTask[]>([])
  const [hoursThisWeek, setHoursThisWeek] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Calculate current week bounds (Mon-Sun)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = Sunday
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    const weekStart = monday.toISOString().split('T')[0]
    const weekEnd = sunday.toISOString().split('T')[0]

    Promise.all([
      fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/time-entries?weekStart=${weekStart}&weekEnd=${weekEnd}&limit=500`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, tk, te]) => {
      if (Array.isArray(p)) setProjects(p)
      if (Array.isArray(tk)) setTasks(tk)
      if (Array.isArray(te)) {
        const total = te.reduce(
          (sum: number, e: { hours?: number; minutes?: number }) =>
            sum + (e.hours ?? 0) + (e.minutes ?? 0) / 60,
          0,
        )
        setHoursThisWeek(Math.round(total * 10) / 10)
      }
    }).catch(() => toast('Failed to load dashboard data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  const activeProjects = projects.filter(p => !['Completed', 'Cancelled'].includes(p.status))
  const pendingTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Completed')
  const upcomingDeadlines = tasks
    .filter(t => t.due_date && t.status !== 'Done' && t.status !== 'Completed')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 6)

  return (
    <>
      {/* KPI Row — no financial data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Projects"  value={String(activeProjects.length)}    icon={<FolderKanban size={17} />} accent="#8b5cf6" sub="In progress"        href="/projects" />
        <KpiCard label="Pending Tasks"    value={String(pendingTasks.length)}      icon={<CheckSquare size={17} />}  accent="#3b82f6" sub="To complete"         href="/tasks" />
        <KpiCard label="Hours This Week"  value={String(hoursThisWeek)}            icon={<Clock size={17} />}        accent="#015035" sub="Time logged"         href="/time-tracking" />
        <KpiCard label="Deadlines"        value={String(upcomingDeadlines.length)} icon={<Calendar size={17} />}     accent="#f59e0b" sub="Upcoming due dates"  href="/tasks" />
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Active Projects */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} style={{ color: '#8b5cf6' }} />
              <h3 className="font-bold text-gray-800 text-sm">Active Projects</h3>
            </div>
            <Link href="/projects" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              View All <ArrowRight size={11} />
            </Link>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No active projects</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {activeProjects.slice(0, 6).map(p => (
                <Link key={p.id} href="/projects" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{p.company}</p>
                    <p className="text-[11px] text-gray-400">{p.serviceType}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 w-8 text-right">{p.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={14} style={{ color: '#f59e0b' }} />
              <h3 className="font-bold text-gray-800 text-sm">Upcoming Deadlines</h3>
            </div>
            <Link href="/tasks" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              View All <ArrowRight size={11} />
            </Link>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No upcoming deadlines</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {upcomingDeadlines.map(t => (
                <Link key={t.id} href="/tasks" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{t.title}</p>
                    <p className="text-[11px] text-gray-400">{t.status}</p>
                  </div>
                  <span className="text-[11px] font-bold text-orange-600 flex-shrink-0 ml-2">
                    Due {t.due_date}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tasks Row */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} style={{ color: '#3b82f6' }} />
            <h3 className="font-bold text-gray-800 text-sm">Pending Tasks</h3>
          </div>
          <Link href="/tasks" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
            View All <ArrowRight size={11} />
          </Link>
        </div>
        {pendingTasks.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">All tasks completed</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingTasks.slice(0, 9).map(t => (
              <Link key={t.id} href="/tasks" className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.status === 'In Progress' ? '#3b82f6' : '#d1d5db' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 truncate">{t.title}</p>
                  {t.due_date && <p className="text-[10px] text-gray-400">Due {t.due_date}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links — no financial links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Projects',      href: '/projects',      icon: <FolderKanban size={16} />, color: '#8b5cf6' },
          { label: 'Maintenance',   href: '/maintenance',   icon: <Wrench size={16} />,       color: '#015035' },
          { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={16} />,        color: '#3b82f6' },
          { label: 'Tasks',         href: '/tasks',         icon: <CheckSquare size={16} />,  color: '#f59e0b' },
        ].map(link => (
          <Link key={link.href} href={link.href} className="metric-card flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${link.color}15` }}>
              <span style={{ color: link.color }}>{link.icon}</span>
            </div>
            <span className="text-sm font-semibold text-gray-800">{link.label}</span>
            <ArrowRight size={13} className="text-gray-300 ml-auto" />
          </Link>
        ))}
      </div>
    </>
  )
}

// ─── Dashboard View Types ────────────────────────────────────────────────────

type DashboardView = 'executive' | 'sales' | 'operations' | 'billing' | 'marketing' | 'contractor'

const DASHBOARD_VIEWS: { id: DashboardView; label: string; icon: React.ReactNode; roles: string[] }[] = [
  { id: 'executive',  label: 'Executive',  icon: <BarChart3 size={14} />,    roles: ['Leadership', 'Super Admin', 'Dept Manager', 'Department Manager'] },
  { id: 'sales',      label: 'Sales',      icon: <TrendingUp size={14} />,   roles: ['Leadership', 'Super Admin', 'Dept Manager', 'Department Manager', 'Team Member'] },
  { id: 'operations', label: 'Operations', icon: <FolderKanban size={14} />, roles: ['Leadership', 'Super Admin', 'Dept Manager', 'Department Manager', 'Team Member'] },
  { id: 'billing',    label: 'Billing',    icon: <DollarSign size={14} />,   roles: ['Leadership', 'Super Admin', 'Dept Manager', 'Department Manager'] },
  { id: 'marketing',  label: 'Marketing',  icon: <Mail size={14} />,         roles: ['Leadership', 'Super Admin', 'Dept Manager', 'Department Manager', 'Team Member'] },
  { id: 'contractor', label: 'Contractor', icon: <Wrench size={14} />,       roles: ['Contractor'] },
]

// ─── View Selector ───────────────────────────────────────────────────────────

function ViewSelector({ view, setView, views }: { view: DashboardView; setView: (v: DashboardView) => void; views: typeof DASHBOARD_VIEWS }) {
  const [open, setOpen] = useState(false)
  const current = views.find(v => v.id === view)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-800 shadow-sm transition-colors"
      >
        {current?.icon}
        {current?.label}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[200px]">
            {views.map(v => (
              <button
                key={v.id}
                onClick={() => { setView(v.id); setOpen(false) }}
                className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                  view === v.id ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={view === v.id ? 'text-emerald-600' : 'text-gray-400'}>{v.icon}</span>
                {v.label}
                {view === v.id && <CheckCircle size={13} className="text-emerald-500 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sales Dashboard ────────────────────────────────────────────────────────

function SalesView({ data }: { data: DashboardData }) {
  const m = data.metrics

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Pipeline Value" value={formatCurrency(m.pipelineValue)}  icon={<TrendingUp size={17} />}  accent="#3b82f6"  sub="Active deals"    href="/crm/pipeline" />
        <KpiCard label="Open Deals"     value={String(m.openDeals)}             icon={<Target size={17} />}      accent="#8b5cf6"  sub="In progress"     href="/crm/pipeline" />
        <KpiCard label="Win Rate"       value={`${m.winRate}%`}                 icon={<CheckCircle size={17} />} accent="#22c55e"  sub="Of decided deals" />
        <KpiCard label="Avg Deal"       value={formatCurrency(m.avgDealSize)}   icon={<DollarSign size={17} />}  accent="#015035"  sub="Closed won avg" />
        <KpiCard label="Proposals"      value={String(data.recentContracts.filter(c => c.status === 'Draft' || c.status === 'Sent').length)} icon={<FileText size={17} />} accent="#f59e0b" sub="Pending" href="/proposals" />
        <KpiCard label="Renewals"       value={String(m.upcomingRenewals)}      icon={<RefreshCw size={17} />}   accent="#ef4444"  sub="Due in 60d"      href="/renewals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="metric-card lg:col-span-2">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Deal Revenue Forecast</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Revenue by month</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.revenueByMonth.reduce((s, r) => s + r.revenue, 0))}</p>
              <p className="text-[11px] text-gray-400">all time</p>
            </div>
          </div>
          <RevenueChart data={data.revenueByMonth} />
        </div>

        {/* Pipeline by stage */}
        <div className="metric-card">
          <h3 className="font-bold text-gray-800 text-sm mb-1">Pipeline by Stage</h3>
          <p className="text-[11px] text-gray-400 mb-4">{m.openDeals} active deals</p>
          {data.recentDeals.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No deals yet</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.recentDeals.map(d => (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{d.company}</p>
                    <p className="text-[10px] text-gray-400">{d.stage} · {d.serviceType}</p>
                  </div>
                  <span className="text-xs font-bold ml-2" style={{ color: '#015035' }}>{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/crm/pipeline" className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
            View Pipeline <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Team activity + contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-sm">Recent Contracts</h3>
            <Link href="/contracts" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
          </div>
          {data.recentContracts.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No contracts yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {data.recentContracts.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{c.company}</p>
                    <StatusBadge label={c.status} colorClass={contractStatusColors[c.status as keyof typeof contractStatusColors] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-sm">Team Activity Totals</h3>
            <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">Last 30 days</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Deals Created', value: data.metrics.deals30d, color: '#3b82f6' },
              { label: 'Contracts', value: data.metrics.contracts30d, color: '#015035' },
              { label: 'Invoices', value: data.metrics.invoices30d, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Operations Dashboard ───────────────────────────────────────────────────

function OperationsView() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<ContractorProject[]>([])
  const [tickets, setTickets] = useState<ContractorTicket[]>([])
  const [tasks, setTasks] = useState<ContractorTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/tickets').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/tasks').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, t, tk]) => {
      if (Array.isArray(p)) setProjects(p)
      if (Array.isArray(t)) setTickets(t)
      if (Array.isArray(tk)) setTasks(tk)
    }).catch(() => toast('Failed to load operations data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" /></div>

  const activeProjects = projects.filter(p => !['Completed', 'Cancelled'].includes(p.status))
  const completedProjects = projects.filter(p => p.status === 'Completed')
  const openTickets = tickets.filter(t => !['Closed', 'Resolved'].includes(t.status))
  const highPriTickets = openTickets.filter(t => t.priority === 'High' || t.priority === 'Urgent')
  const pendingTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Completed')
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress')

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Active Projects"    value={String(activeProjects.length)}    icon={<FolderKanban size={17} />}  accent="#8b5cf6"  sub="In progress"     href="/projects" />
        <KpiCard label="Open Tickets"       value={String(openTickets.length)}       icon={<MessageSquare size={17} />} accent="#f59e0b"  sub={`${highPriTickets.length} high priority`} href="/tickets" />
        <KpiCard label="Pending Tasks"      value={String(pendingTasks.length)}      icon={<CheckSquare size={17} />}   accent="#3b82f6"  sub={`${inProgressTasks.length} in progress`}  href="/tasks" />
        <KpiCard label="Completed"          value={String(completedProjects.length)} icon={<CheckCircle size={17} />}   accent="#22c55e"  sub="Projects done"   href="/projects" />
        <KpiCard label="Total Tasks"        value={String(tasks.length)}             icon={<Briefcase size={17} />}     accent="#015035"  sub="All time"        href="/tasks" />
        <KpiCard label="Total Tickets"      value={String(tickets.length)}           icon={<AlertCircle size={17} />}   accent="#ef4444"  sub="All time"        href="/tickets" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderKanban size={14} style={{ color: '#8b5cf6' }} />
              <h3 className="font-bold text-gray-800 text-sm">Active Projects</h3>
            </div>
            <Link href="/projects" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No active projects</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {activeProjects.slice(0, 6).map(p => (
                <Link key={p.id} href="/projects" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{p.company}</p>
                    <p className="text-[11px] text-gray-400">{p.serviceType}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: '#015035' }} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500 w-8 text-right">{p.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} style={{ color: '#f59e0b' }} />
              <h3 className="font-bold text-gray-800 text-sm">Open Tickets</h3>
            </div>
            <Link href="/tickets" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
          </div>
          {openTickets.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No open tickets</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {openTickets.slice(0, 6).map(t => {
                const priColor = t.priority === 'High' || t.priority === 'Urgent' ? 'text-red-600 bg-red-50' : t.priority === 'Medium' ? 'text-orange-600 bg-orange-50' : 'text-gray-600 bg-gray-50'
                return (
                  <Link key={t.id} href="/tickets" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate">{t.subject}</p>
                      <p className="text-[11px] text-gray-400">{t.company}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${priColor}`}>{t.priority}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tasks grid */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} style={{ color: '#3b82f6' }} />
            <h3 className="font-bold text-gray-800 text-sm">Pending Tasks</h3>
          </div>
          <Link href="/tasks" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
        </div>
        {pendingTasks.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">All tasks completed</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingTasks.slice(0, 9).map(t => (
              <Link key={t.id} href="/tasks" className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.status === 'In Progress' ? '#3b82f6' : '#d1d5db' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 truncate">{t.title}</p>
                  {t.due_date && <p className="text-[10px] text-gray-400">Due {t.due_date}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Billing Dashboard ──────────────────────────────────────────────────────

function BillingView({ data }: { data: DashboardData }) {
  const m = data.metrics
  const overdueInvoices = data.recentInvoices.filter(i => i.status === 'Overdue')

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Collected"       value={formatCurrency(m.totalCollected)}   icon={<DollarSign size={17} />}   accent="#22c55e"  sub="Total paid"       href="/billing" />
        <KpiCard label="Overdue"         value={formatCurrency(m.totalOverdue)}     icon={<AlertCircle size={17} />}  accent="#ef4444"  sub={`${m.overdueInvoices} invoices`} href="/billing" />
        <KpiCard label="Pending"         value={formatCurrency(m.totalPending)}     icon={<Clock size={17} />}        accent="#f59e0b"  sub="Awaiting payment" href="/billing" />
        <KpiCard label="Active Clients"  value={String(m.activeClients)}            icon={<Users size={17} />}        accent="#015035"  sub="With contracts"   href="/contracts" />
        <KpiCard label="Total Invoiced"  value={formatCurrency(m.totalInvoiced)}    icon={<FileText size={17} />}     accent="#8b5cf6"  sub="All invoices"     href="/billing" />
        <KpiCard label="Renewals (60d)"  value={String(m.upcomingRenewals)}         icon={<RefreshCw size={17} />}    accent="#3b82f6"  sub="Coming up"        href="/renewals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="metric-card lg:col-span-2">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Revenue by Month</h3>
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-700" /> One-time</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> Recurring</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.revenueByMonth.reduce((s, r) => s + r.revenue, 0))}</p>
              <p className="text-[11px] text-gray-400">all time</p>
            </div>
          </div>
          <RevenueChart data={data.revenueByMonth} />
        </div>

        {/* Overdue invoices */}
        <div className="metric-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-red-500" />
            <h3 className="font-bold text-gray-800 text-sm">Overdue Invoices</h3>
          </div>
          {overdueInvoices.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No overdue invoices</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {overdueInvoices.map(inv => (
                <Link key={inv.id} href="/billing" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{inv.company}</p>
                    <p className="text-[10px] text-gray-400">Due {inv.dueDate}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600">{formatCurrency(inv.amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All invoices */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">Recent Invoices</h3>
          <Link href="/billing" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
        </div>
        <div className="flex flex-col divide-y divide-gray-50">
          {data.recentInvoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800">{inv.company}</p>
                <p className="text-[10px] text-gray-400">{inv.serviceType}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                <StatusBadge label={inv.status} colorClass={invoiceStatusColors[inv.status as keyof typeof invoiceStatusColors] ?? 'bg-gray-100 text-gray-600'} />
                <span className="text-xs font-bold text-gray-700 w-20 text-right">{formatCurrency(inv.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── Marketing Dashboard ────────────────────────────────────────────────────

function MarketingView() {
  const { toast } = useToast()
  const [broadcasts, setBroadcasts] = useState<Array<{ id: string; name: string; subject: string; status: string; totalSent: number; totalOpened: number; totalClicked: number; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/broadcasts')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setBroadcasts(data) })
      .catch(() => toast('Failed to load marketing data', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" /></div>

  const sent = broadcasts.filter(b => b.status === 'sent')
  const totalSent = broadcasts.reduce((s, b) => s + (b.totalSent || 0), 0)
  const totalOpened = broadcasts.reduce((s, b) => s + (b.totalOpened || 0), 0)
  const totalClicked = broadcasts.reduce((s, b) => s + (b.totalClicked || 0), 0)
  const avgOpen = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const avgClick = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Broadcasts Sent" value={String(sent.length)}          icon={<Send size={17} />}      accent="#015035"  sub="Campaigns"       href="/marketing" />
        <KpiCard label="Emails Sent"     value={totalSent.toLocaleString()}   icon={<Mail size={17} />}      accent="#3b82f6"  sub="Total delivered" href="/marketing" />
        <KpiCard label="Avg Open Rate"   value={`${avgOpen}%`}               icon={<Eye size={17} />}       accent="#22c55e"  sub="Across campaigns" />
        <KpiCard label="Avg Click Rate"  value={`${avgClick}%`}              icon={<Target size={17} />}    accent="#8b5cf6"  sub="Click-through" />
        <KpiCard label="Total Opens"     value={totalOpened.toLocaleString()} icon={<BarChart3 size={17} />} accent="#f59e0b"  sub="All time" />
        <KpiCard label="Drafts"          value={String(broadcasts.filter(b => b.status === 'draft').length)} icon={<FileText size={17} />} accent="#6b7280" sub="In progress" href="/marketing" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-sm">Recent Broadcasts</h3>
            <Link href="/marketing" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">View All <ArrowRight size={11} /></Link>
          </div>
          {broadcasts.length === 0 ? (
            <div className="text-center py-8">
              <Mail size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No broadcasts yet</p>
              <p className="text-xs text-gray-300 mt-1">Create one to start sending campaigns</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {broadcasts.slice(0, 6).map(b => {
                const openRate = b.totalSent > 0 ? Math.round((b.totalOpened / b.totalSent) * 100) : 0
                return (
                  <Link key={b.id} href="/marketing" className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate">{b.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{b.subject}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      {b.status === 'sent' && <span className="text-[10px] font-bold text-emerald-600">{openRate}% opened</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : b.status === 'draft' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                        {b.status}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-4">
          <div className="metric-card">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Marketing Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Broadcasts',  href: '/marketing',      icon: <Mail size={16} />,          color: '#015035' },
                { label: 'Forms',       href: '/forms',          icon: <FileText size={16} />,      color: '#3b82f6' },
                { label: 'Sequences',   href: '/crm/sequences',  icon: <Zap size={16} />,           color: '#8b5cf6' },
                { label: 'Social',      href: '/social',         icon: <MessageSquare size={16} />, color: '#f59e0b' },
              ].map(link => (
                <Link key={link.href} href={link.href} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${link.color}15` }}>
                    <span style={{ color: link.color }}>{link.icon}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Performance Summary</h3>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Total Campaigns', value: String(broadcasts.length) },
                { label: 'Emails Delivered', value: totalSent.toLocaleString(), green: true },
                { label: 'Total Opens', value: totalOpened.toLocaleString(), green: true },
                { label: 'Total Clicks', value: totalClicked.toLocaleString() },
                { label: 'Avg Open Rate', value: `${avgOpen}%`, green: avgOpen > 20 },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-0.5">
                  <span className="text-[12px] text-gray-500">{s.label}</span>
                  <span className={`text-[12px] font-bold ${s.green ? 'text-emerald-600' : 'text-gray-800'}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Executive View ─────────────────────────────────────────────────────────

function AiInsightsWidget() {
  const [recs, setRecs] = useState<{ type: string; priority: string; title: string; description: string; suggestedAction: string; companyName?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  function loadRecs() {
    if (loaded) return
    setLoading(true)
    fetch('/api/ai/recommendations?type=all')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setRecs(data) })
      .catch(() => {})
      .finally(() => { setLoading(false); setLoaded(true) })
  }

  useEffect(() => {
    fetch('/api/ai/recommendations?type=all')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setRecs(data) })
      .catch(() => {})
      .finally(() => { setLoading(false); setLoaded(true) })
  }, [])

  const priorityStyles: Record<string, string> = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-yellow-50 text-yellow-700',
    low: 'bg-gray-50 text-gray-500',
  }

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-600" />
          <h3 className="font-bold text-gray-800 text-sm">AI Insights</h3>
        </div>
        <button
          onClick={() => { setLoaded(false); loadRecs() }}
          className="text-[10px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
          <span className="text-xs text-gray-400">Analyzing your CRM...</span>
        </div>
      ) : recs.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No recommendations right now</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-50">
          {recs.slice(0, 3).map((rec, i) => (
            <div key={i} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityStyles[rec.priority] ?? priorityStyles.low}`}>
                  {rec.priority}
                </span>
                {rec.companyName && <span className="text-[10px] text-gray-400">{rec.companyName}</span>}
              </div>
              <p className="text-[12px] font-semibold text-gray-800">{rec.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{rec.suggestedAction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExecutiveView({ data, user }: { data: DashboardData; user: { name: string; isAdmin?: boolean } | null }) {
  const m = data.metrics
  const pendingContracts = data.recentContracts.filter(c =>
    ['Sent', 'Viewed', 'Countersign Needed', 'Signed by Client'].includes(c.status)
  )
  const overdueInvoices = data.recentInvoices.filter(i => i.status === 'Overdue')

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Pipeline"       value={formatCurrency(m.pipelineValue)}  icon={<TrendingUp size={17} />}   accent="#3b82f6"  sub="Active deals"        href="/crm/pipeline" />
        <KpiCard label="Active Clients" value={String(m.activeClients)}          icon={<CheckCircle size={17} />}  accent="#015035"  sub="Executed contracts"  href="/contracts" />
        <KpiCard label="Collected"      value={formatCurrency(m.totalCollected)} icon={<DollarSign size={17} />}   accent="#22c55e"  sub="Payments received"   href="/billing" />
        <KpiCard label="Open Deals"     value={String(m.openDeals)}              icon={<RefreshCw size={17} />}    accent="#8b5cf6"  sub="In pipeline"         href="/crm/pipeline" />
        <KpiCard label="Overdue"        value={String(m.overdueInvoices)}        icon={<FolderKanban size={17} />} accent="#f59e0b"  sub="Invoices overdue"    href="/billing" />
        <KpiCard label="Renewals (60d)" value={String(m.upcomingRenewals)}       icon={<Calendar size={17} />}     accent="#ef4444"  sub="Due soon"            href="/renewals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="metric-card lg:col-span-2">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Revenue by Month</h3>
              <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-700" /> One-time</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> Recurring</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.revenueByMonth.reduce((s, r) => s + r.revenue, 0))}</p>
              <p className="text-[11px] text-gray-400">total</p>
            </div>
          </div>
          <RevenueChart data={data.revenueByMonth} />
        </div>

        <div className="metric-card">
          <h3 className="font-bold text-gray-800 text-sm mb-1">Pipeline by Stage</h3>
          <p className="text-[11px] text-gray-400 mb-4">{m.openDeals} active deals</p>
          {data.recentDeals.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No deals yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.recentDeals.slice(0, 4).map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 font-medium truncate max-w-[140px]">{d.company}</span>
                  <span className="text-gray-500 font-bold ml-2">{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/crm/pipeline" className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
            View Pipeline <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${user?.isAdmin ? 'lg:grid-cols-3' : ''} gap-4`}>
        {user?.isAdmin && (
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">Recent Activity</h3>
              <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">Live feed</span>
            </div>
            <div className="flex flex-col divide-y divide-gray-50">
              {data.activityFeed.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No activity yet.</p>
              ) : data.activityFeed.map((item) => {
                const meta = activityMeta[item.type] ?? activityMeta.action
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${meta.color}14`, color: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-800 leading-snug">{item.action}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 font-semibold">{item.user}</span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-[11px] text-gray-400">{item.module}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="metric-card">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-orange-500" />
              <h3 className="font-bold text-gray-800 text-sm">Needs Attention</h3>
            </div>
            <div className="flex flex-col">
              {pendingContracts.slice(0, 3).map(c => (
                <Link key={c.id} href="/contracts" className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{c.company}</p>
                    <StatusBadge label={c.status} colorClass={contractStatusColors[c.status as keyof typeof contractStatusColors] ?? 'bg-gray-100 text-gray-600'} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 ml-2">{formatCurrency(c.value)}</span>
                </Link>
              ))}
              {overdueInvoices.map(inv => (
                <Link key={inv.id} href="/billing" className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{inv.company}</p>
                    <StatusBadge label="Invoice Overdue" colorClass={invoiceStatusColors['Overdue']} />
                  </div>
                  <span className="text-xs font-bold text-red-600 ml-2">{formatCurrency(inv.amount)}</span>
                </Link>
              ))}
              {pendingContracts.length === 0 && overdueInvoices.length === 0 && (
                <p className="text-xs text-gray-400 py-3 text-center">All clear</p>
              )}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Quick Stats</h3>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Open Deals', value: String(m.openDeals) },
                { label: 'Active Clients', value: String(m.activeClients), green: true },
                { label: 'Overdue Invoices', value: String(m.overdueInvoices), red: m.overdueInvoices > 0 },
                { label: 'Renewals Due', value: String(m.upcomingRenewals), red: m.upcomingRenewals > 0 },
                { label: 'Pipeline Value', value: formatCurrency(m.pipelineValue), green: true },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-0.5">
                  <span className="text-[12px] text-gray-500">{s.label}</span>
                  <span className={`text-[12px] font-bold ${s.green ? 'text-emerald-600' : (s as {red?: boolean}).red ? 'text-red-500' : 'text-gray-800'}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <AiInsightsWidget />

          <div className="metric-card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#015035' }} />
              <h3 className="font-bold text-gray-800 text-sm">Automation</h3>
            </div>
            <div className="flex flex-col gap-2">
              {data.automations && data.automations.length > 0 ? (
                data.automations.slice(0, 4).map((a, i) => {
                  const statusMap: Record<string, { dot: string; cls: string }> = {
                    Active: { dot: '#22c55e', cls: 'text-emerald-600' },
                    Paused: { dot: '#9ca3af', cls: 'text-gray-500' },
                    Draft: { dot: '#3b82f6', cls: 'text-blue-500' },
                  }
                  const style = statusMap[a.status] ?? statusMap.Active
                  return (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-500 truncate">{a.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                        <span className={`text-[11px] font-bold ${style.cls}`}>{a.status}</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-[11px] text-gray-400">No automations configured</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const settings = useSettings()
  const [data, setData] = useState<DashboardData>(emptyData)
  const [loading, setLoading] = useState(true)

  const isContractor = user?.role === 'Contractor' || user?.unit === 'Contractors'
  const isAdmin = user?.isAdmin || user?.role === 'Leadership' || user?.role === 'Super Admin'

  const availableViews = isAdmin
    ? DASHBOARD_VIEWS
    : isContractor
      ? DASHBOARD_VIEWS.filter(v => v.id === 'contractor')
      : DASHBOARD_VIEWS.filter(v => v.id !== 'contractor' && v.roles.includes(user?.role ?? 'Team Member'))

  // Default view based on user's occupational unit
  const defaultView: DashboardView = isContractor
    ? 'contractor'
    : user?.unit === 'Sales'
      ? 'sales'
      : user?.unit === 'Billing/Finance'
        ? 'billing'
        : user?.unit === 'Delivery/Operations'
          ? 'operations'
          : 'executive'
  const [view, setView] = useState<DashboardView>(defaultView)

  useEffect(() => {
    if (view === 'contractor') return
    if (view === 'operations') return
    if (view === 'marketing') return
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.metrics) setData(d) })
      .catch(() => toast('Failed to load dashboard data', 'error'))
      .finally(() => setLoading(false))
  }, [view])

  const viewLabel = DASHBOARD_VIEWS.find(v => v.id === view)?.label ?? 'Dashboard'
  const showSpinner = loading && !['contractor', 'operations', 'marketing'].includes(view)

  if (showSpinner) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Dashboard" subtitle={`${settings?.company.name ?? 'Graviss Marketing'} — ${viewLabel}`} />
      <div className="page-content">
        {/* View selector + greeting */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ViewSelector view={view} setView={setView} views={availableViews} />
          {isAdmin && (
            <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
              Viewing all dashboards (Admin)
            </span>
          )}
        </div>

        {user && <GreetingBanner name={user.name} />}
        {user && <MagicMomentToast name={user.name} />}
        <LiveClock />

        {/* Dashboard views */}
        {view === 'executive' && <ExecutiveView data={data} user={user} />}
        {view === 'sales' && <SalesView data={data} />}
        {view === 'operations' && <OperationsView />}
        {view === 'billing' && <BillingView data={data} />}
        {view === 'marketing' && <MarketingView />}
        {view === 'contractor' && user && <ContractorDashboard userName={user.name} />}
      </div>
    </>
  )
}
