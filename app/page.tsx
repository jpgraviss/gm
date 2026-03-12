'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, CheckCircle, RefreshCw,
  FolderKanban, Calendar, ArrowUpRight, ArrowRight,
  FileText, ScrollText, AlertCircle, Zap,
} from 'lucide-react'
import { formatCurrency, contractStatusColors, invoiceStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import type { RevenueMonth } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

// ─── Greeting ─────────────────────────────────────────────────────────────────

interface Greeting { headline: string; sub: string; emoji: string }

function buildGreeting(fullName: string, now: Date): Greeting {
  const firstName = fullName.split(' ')[0]
  const hour = now.getHours()
  const day  = now.getDay() // 0=Sun … 6=Sat

  const timePrefix =
    hour >= 5  && hour < 12 ? 'Good Morning'           :
    hour >= 12 && hour < 17 ? 'Good Afternoon'          :
    hour >= 17 && hour < 23 ? 'Good Evening'            :
    'Burning the midnight oil' // midnight – 5am

  const timeEmoji =
    hour >= 5  && hour < 12 ? '☀️'  :
    hour >= 12 && hour < 17 ? '🌤️' :
    hour >= 17 && hour < 23 ? '🌆'  :
    '🌙'

  const dayMeta: Record<number, { label: string; msg: string; emoji: string }> = {
    0: { label: 'Happy Sunday',    msg: 'Hope you\'re recharging — big week ahead.',        emoji: '😎' },
    1: { label: 'Happy Monday',    msg: 'New week, new wins. Let\'s make it count.',         emoji: '🚀' },
    2: { label: 'Happy Tuesday',   msg: 'Momentum is everything — keep it rolling.',         emoji: '💪' },
    3: { label: 'Happy Wednesday', msg: 'Halfway there. You\'re crushing it.',               emoji: '⚡' },
    4: { label: 'Happy Thursday',  msg: 'Almost at the finish line — push through.',         emoji: '🎯' },
    5: { label: 'Happy Friday',    msg: 'Last push of the week. Finish strong.',             emoji: '🎉' },
    6: { label: 'Happy Saturday',  msg: 'Hustle day or rest day — you earned the choice.',   emoji: '🌟' },
  }

  const { label: dayLabel, msg, emoji: dayEmoji } = dayMeta[day]

  // Weekends: lead with Happy [Day]
  if (day === 0 || day === 6) {
    return { headline: `${dayLabel}, ${firstName}!`, sub: msg, emoji: dayEmoji }
  }

  // Friday: blend celebration with time greeting
  if (day === 5) {
    return { headline: `${timePrefix}, ${firstName}!`, sub: `${dayLabel} — ${msg}`, emoji: dayEmoji }
  }

  // Weekdays: time-based greeting with day sub-line
  return { headline: `${timePrefix}, ${firstName}!`, sub: `${dayLabel} — ${msg}`, emoji: timeEmoji }
}

function GreetingBanner({ name }: { name: string }) {
  const [visible, setVisible]   = useState(false)
  const [greeting, setGreeting] = useState<Greeting>({ headline: '', sub: '', emoji: '' })

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gravhub_login_at')
      if (!raw) return
      const loginAt = parseInt(raw, 10)
      const elapsed = Date.now() - loginAt
      const THREE_MIN = 3 * 60 * 1000
      if (elapsed >= THREE_MIN) return
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGreeting(buildGreeting(name, new Date())) // user's local timezone
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), THREE_MIN - elapsed)
      return () => clearTimeout(timer)
    } catch {/* ignore */}
  }, [name])

  if (!visible) return null

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
          {greeting.headline}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>
          {greeting.sub}
        </p>
      </div>
      <span style={{ fontSize: '48px', lineHeight: 1, userSelect: 'none' }} aria-hidden>
        {greeting.emoji}
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
              style={{ height: `${((d.revenue - d.recurring) / max) * 112}px`, background: '#015035' }}
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
    monthlyRevenue: number
    overdueInvoices: number
    upcomingRenewals: number
  }
  recentDeals: Array<{ id: string; company: string; stage: string; value: number; serviceType: string; lastActivity: string }>
  recentContracts: Array<{ id: string; company: string; status: string; value: number; renewalDate: string; serviceType: string }>
  recentInvoices: Array<{ id: string; company: string; amount: number; status: string; dueDate: string; serviceType: string; contractId: string }>
  activityFeed: Array<{ id: string; user: string; action: string; module: string; type: string; timestamp: string }>
  revenueByMonth: RevenueMonth[]
}

const emptyData: DashboardData = {
  metrics: { activeClients: 0, openDeals: 0, pipelineValue: 0, monthlyRevenue: 0, overdueInvoices: 0, upcomingRenewals: 0 },
  recentDeals: [],
  recentContracts: [],
  recentInvoices: [],
  activityFeed: [],
  revenueByMonth: [],
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
  const suffix   = date === 1 ? 'st' : date === 2 ? 'nd' : date === 3 ? 'rd' : 'th'

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

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData>(emptyData)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { if (d.metrics) setData(d) })
      .catch(() => {})
  }, [])

  const m = data.metrics
  const pendingContracts = data.recentContracts.filter(c =>
    ['Sent', 'Viewed', 'Countersign Needed', 'Signed by Client'].includes(c.status)
  )
  const overdueInvoices = data.recentInvoices.filter(i => i.status === 'Overdue')

  return (
    <>
      <Header title="Dashboard" subtitle="Graviss Marketing — Executive Overview" />
      <div className="page-content">

        {/* Greeting + Clock */}
        {user && <GreetingBanner name={user.name} />}
        {user && <MagicMomentToast name={user.name} />}
        <LiveClock />

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Pipeline"       value={formatCurrency(m.pipelineValue)}  icon={<TrendingUp size={17} />}   accent="#3b82f6"  sub="Active deals"        href="/crm/pipeline" />
          <KpiCard label="Active Clients" value={String(m.activeClients)}          icon={<CheckCircle size={17} />}  accent="#015035"  sub="Executed contracts"  href="/contracts" />
          <KpiCard label="Collected"      value={formatCurrency(m.monthlyRevenue)} icon={<DollarSign size={17} />}   accent="#22c55e"  sub="Payments received"   href="/billing" />
          <KpiCard label="Open Deals"     value={String(m.openDeals)}              icon={<RefreshCw size={17} />}    accent="#8b5cf6"  sub="In pipeline"         href="/crm/pipeline" />
          <KpiCard label="Overdue"        value={String(m.overdueInvoices)}        icon={<FolderKanban size={17} />} accent="#f59e0b"  sub="Invoices overdue"    href="/billing" />
          <KpiCard label="Renewals (60d)" value={String(m.upcomingRenewals)}       icon={<Calendar size={17} />}     accent="#ef4444"  sub="Due soon"            href="/renewals" />
        </div>

        {/* Charts Row */}
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

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Activity feed */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm">Recent Activity</h3>
              <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">Live feed</span>
            </div>
            <div className="flex flex-col divide-y divide-gray-50">
              {data.activityFeed.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No activity yet. Start by adding deals or contacts.</p>
              ) : data.activityFeed.map((item) => {
                const meta = activityMeta[item.type] ?? activityMeta.action
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${meta.color}14`, color: meta.color }}
                    >
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

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Needs attention */}
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
                  <p className="text-xs text-gray-400 py-3 text-center">All clear — nothing needs action</p>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="metric-card">
              <h3 className="font-bold text-gray-800 text-sm mb-3">Quick Stats</h3>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Open Deals',       value: String(m.openDeals) },
                  { label: 'Active Clients',   value: String(m.activeClients), green: true },
                  { label: 'Overdue Invoices', value: String(m.overdueInvoices), red: m.overdueInvoices > 0 },
                  { label: 'Renewals Due',     value: String(m.upcomingRenewals), red: m.upcomingRenewals > 0 },
                  { label: 'Pipeline Value',   value: formatCurrency(m.pipelineValue), green: true },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-0.5">
                    <span className="text-[12px] text-gray-500">{s.label}</span>
                    <span className={`text-[12px] font-bold ${s.green ? 'text-emerald-600' : (s as {red?: boolean}).red ? 'text-red-500' : 'text-gray-800'}`}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Automation */}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} style={{ color: '#015035' }} />
                <h3 className="font-bold text-gray-800 text-sm">Automation</h3>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Contract follow-up',   status: 'Running',   dot: '#22c55e', cls: 'text-emerald-600' },
                  { label: 'Invoice reminders',    status: 'Running',   dot: '#22c55e', cls: 'text-emerald-600' },
                  { label: 'Renewal alerts (60d)', status: 'Triggered', dot: '#f97316', cls: 'text-orange-500'  },
                  { label: 'Project kickoff flow', status: 'Queued',    dot: '#3b82f6', cls: 'text-blue-500'    },
                ].map(a => (
                  <div key={a.label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500">{a.label}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} />
                      <span className={`text-[11px] font-bold ${a.cls}`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
