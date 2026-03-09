import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, CheckCircle, RefreshCw,
  FolderKanban, Calendar, ArrowUpRight, ArrowRight,
  FileText, ScrollText, AlertCircle, Zap,
} from 'lucide-react'
import { dashboardMetrics, activityFeed, revenueByMonth, deals, contracts, invoices } from '@/lib/data'
import { formatCurrency, contractStatusColors, invoiceStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent, trend,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string; trend?: string
}) {
  return (
    <div className="kpi-card" style={{ '--kpi-accent': accent } as React.CSSProperties}>
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
}

// ─── Revenue Bar Chart ────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: typeof revenueByMonth }) {
  const max = Math.max(...data.map(d => d.revenue))
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

// ─── Pipeline bar ─────────────────────────────────────────────────────────────

function PipelineBar() {
  const stages = [
    { label: 'Lead',      count: 1, color: '#9ca3af' },
    { label: 'Qualified', count: 2, color: '#3b82f6' },
    { label: 'Proposal',  count: 2, color: '#f59e0b' },
    { label: 'Contract',  count: 1, color: '#f97316' },
    { label: 'Won',       count: 2, color: '#22c55e' },
  ]
  const total = stages.reduce((s, st) => s + st.count, 0)
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 mb-3 gap-px">
        {stages.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-gray-500 truncate">{s.label} <span className="font-bold text-gray-700">({s.count})</span></span>
          </div>
        ))}
      </div>
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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const m = dashboardMetrics
  const pendingContracts = contracts.filter(c =>
    ['Sent', 'Viewed', 'Countersign Needed', 'Signed by Client'].includes(c.status)
  )
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue')

  return (
    <>
      <Header title="Dashboard" subtitle="Graviss Marketing — Executive Overview" />
      <div className="page-content">

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard label="Pipeline"       value={formatCurrency(m.pipelineValue)}    icon={<TrendingUp size={17} />}   accent="#3b82f6" trend="+12%"  sub="Active deals" />
          <KpiCard label="Booked"         value={formatCurrency(m.bookedRevenue)}    icon={<CheckCircle size={17} />}  accent="#015035" trend="+8%"   sub="Executed contracts" />
          <KpiCard label="Collected"      value={formatCurrency(m.revenueCollected)} icon={<DollarSign size={17} />}   accent="#22c55e" trend="+23%"  sub="Payments received" />
          <KpiCard label="MRR"            value={formatCurrency(m.mrr)}              icon={<RefreshCw size={17} />}    accent="#8b5cf6" trend="+5%"   sub="Monthly recurring" />
          <KpiCard label="Projects"       value={String(m.activeProjects)}           icon={<FolderKanban size={17} />} accent="#f59e0b"               sub="In delivery" />
          <KpiCard label="Renewals (90d)" value={String(m.upcomingRenewals)}         icon={<Calendar size={17} />}     accent="#ef4444"               sub="Due soon" />
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
                <p className="text-lg font-bold text-gray-900">{formatCurrency(revenueByMonth.reduce((s, r) => s + r.revenue, 0))}</p>
                <p className="text-[11px] text-gray-400">6-month total</p>
              </div>
            </div>
            <RevenueChart data={revenueByMonth} />
          </div>

          <div className="metric-card">
            <h3 className="font-bold text-gray-800 text-sm mb-1">Pipeline by Stage</h3>
            <p className="text-[11px] text-gray-400 mb-4">{deals.length} active deals</p>
            <PipelineBar />
            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
              {[
                { label: 'Conversion rate', value: '37.5%', green: true },
                { label: 'Avg deal size', value: formatCurrency(26125) },
                { label: 'Avg close time', value: '28 days' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">{s.label}</span>
                  <span className={`font-bold ${s.green ? 'text-emerald-600' : 'text-gray-800'}`}>{s.value}</span>
                </div>
              ))}
            </div>
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
              {activityFeed.map((item) => {
                const meta = activityMeta[item.type] ?? activityMeta.task
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${meta.color}14`, color: meta.color }}
                    >
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-800 leading-snug">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500 font-semibold">{item.company}</span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-[11px] text-gray-400">{item.timestamp}</span>
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
                      <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 ml-2">{formatCurrency(c.value)}</span>
                  </Link>
                ))}
                {overdueInvoices.map(inv => (
                  <Link key={inv.id} href="/billing" className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div>
                      <p className="text-[12px] font-semibold text-gray-800">{inv.company}</p>
                      <StatusBadge label="Invoice Overdue" colorClass="bg-red-100 text-red-600" />
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
                  { label: 'ARR',              value: formatCurrency(m.mrr * 12),       green: true },
                  { label: 'Collection Rate',  value: '94%',                             green: true },
                  { label: 'Renewal Rate',     value: '78%',                             green: true },
                  { label: 'Avg Invoice',      value: formatCurrency(4671) },
                  { label: 'Overdue Invoices', value: String(overdueInvoices.length),    red: overdueInvoices.length > 0 },
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
                  { label: 'Renewal alerts (90d)', status: 'Triggered', dot: '#f97316', cls: 'text-orange-500'  },
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
