import Header from '@/components/layout/Header'
import {
  TrendingUp, DollarSign, CheckCircle, RefreshCw,
  FolderKanban, Calendar, ArrowUpRight, Clock,
  FileText, ScrollText, AlertCircle, Zap,
} from 'lucide-react'
import { dashboardMetrics, activityFeed, revenueByMonth, deals, contracts, invoices } from '@/lib/data'
import { formatCurrency, proposalStatusColors, contractStatusColors, invoiceStatusColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'

function MetricCard({
  label, value, sub, icon, color, trend,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
  trend?: string
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
            <ArrowUpRight size={12} />
            {trend}
          </span>
        )}
      </div>
      <p
        className="text-2xl font-bold text-gray-900 mb-1"
        style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ data }: { data: typeof revenueByMonth }) {
  const max = Math.max(...data.map(d => d.revenue))
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col items-center gap-0.5">
            <div
              className="bar-chart-bar w-full"
              style={{ height: `${(d.revenue / max) * 96}px`, background: '#015035', borderRadius: '4px 4px 0 0' }}
              title={formatCurrency(d.revenue)}
            />
            <div
              className="w-full"
              style={{ height: `${(d.recurring / max) * 96}px`, background: '#FFF3EA', border: '1px solid #e5c9b2', borderRadius: '0 0 4px 4px', marginTop: -1 }}
              title={`Recurring: ${formatCurrency(d.recurring)}`}
            />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">{d.month}</span>
        </div>
      ))}
    </div>
  )
}

function PipelineBar() {
  const stages = [
    { label: 'Lead', count: 1, color: '#9ca3af' },
    { label: 'Qualified', count: 2, color: '#3b82f6' },
    { label: 'Proposal', count: 2, color: '#f59e0b' },
    { label: 'Contract', count: 1, color: '#f97316' },
    { label: 'Won', count: 2, color: '#22c55e' },
  ]
  const total = stages.reduce((s, st) => s + st.count, 0)
  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-3 mb-3">
        {stages.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-gray-500">{s.label} ({s.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const activityIcons: Record<string, React.ReactNode> = {
  deal: <TrendingUp size={13} />,
  contract: <ScrollText size={13} />,
  invoice: <DollarSign size={13} />,
  proposal: <FileText size={13} />,
  project: <FolderKanban size={13} />,
  task: <CheckCircle size={13} />,
}

const activityColors: Record<string, string> = {
  deal: '#3b82f6',
  contract: '#015035',
  invoice: '#22c55e',
  proposal: '#f59e0b',
  project: '#8b5cf6',
  task: '#14b8a6',
}

export default function DashboardPage() {
  const m = dashboardMetrics
  const pendingContracts = contracts.filter(c => ['Sent', 'Viewed', 'Countersign Needed', 'Signed by Client'].includes(c.status))
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue')
  const recentDeals = deals.slice(0, 4)

  return (
    <>
      <Header title="Executive Dashboard" subtitle="Graviss Marketing — Internal Operating System" />
      <div className="p-3 sm:p-6 flex-1">

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <MetricCard
            label="Pipeline Value"
            value={formatCurrency(m.pipelineValue)}
            icon={<TrendingUp size={16} />}
            color="#3b82f6"
            trend="+12%"
            sub="Active deals"
          />
          <MetricCard
            label="Booked Revenue"
            value={formatCurrency(m.bookedRevenue)}
            icon={<CheckCircle size={16} />}
            color="#015035"
            trend="+8%"
            sub="Executed contracts"
          />
          <MetricCard
            label="Collected"
            value={formatCurrency(m.revenueCollected)}
            icon={<DollarSign size={16} />}
            color="#22c55e"
            trend="+23%"
            sub="Payments received"
          />
          <MetricCard
            label="MRR"
            value={formatCurrency(m.mrr)}
            icon={<RefreshCw size={16} />}
            color="#8b5cf6"
            trend="+5%"
            sub="Monthly recurring"
          />
          <MetricCard
            label="Active Projects"
            value={String(m.activeProjects)}
            icon={<FolderKanban size={16} />}
            color="#f59e0b"
            sub="In delivery"
          />
          <MetricCard
            label="Renewals (90d)"
            value={String(m.upcomingRenewals)}
            icon={<Calendar size={16} />}
            color="#ef4444"
            sub="Due soon"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Revenue Chart */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Revenue by Month</h3>
                <p className="text-gray-400 text-xs mt-0.5">Green = one-time / Tan = recurring</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">Last 6 months</span>
            </div>
            <BarChart data={revenueByMonth} />
          </div>

          {/* Pipeline By Stage */}
          <div className="metric-card">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">Pipeline by Stage</h3>
              <p className="text-gray-400 text-xs mt-0.5">8 active deals</p>
            </div>
            <PipelineBar />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Conversion rate</span>
                <span className="text-emerald-600 font-semibold">37.5%</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Avg deal size</span>
                <span className="font-medium text-gray-700">{formatCurrency(26125)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Avg close time</span>
                <span className="font-medium text-gray-700">28 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity + Alerts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Activity Feed */}
          <div className="metric-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-sm">Recent Activity</h3>
              <span className="text-xs text-gray-400">Live feed</span>
            </div>
            <div className="flex flex-col gap-3">
              {activityFeed.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${activityColors[item.type]}18`, color: activityColors[item.type] }}
                  >
                    {activityIcons[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 font-medium">{item.company}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{item.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts & Actions */}
          <div className="flex flex-col gap-4">
            {/* Contracts Awaiting Action */}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={15} className="text-orange-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Needs Action</h3>
              </div>
              <div className="flex flex-col gap-2">
                {pendingContracts.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{c.company}</p>
                      <StatusBadge label={c.status} colorClass={contractStatusColors[c.status]} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{formatCurrency(c.value)}</span>
                  </div>
                ))}
                {overdueInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{inv.company}</p>
                      <StatusBadge label="Invoice Overdue" colorClass="bg-red-100 text-red-600" />
                    </div>
                    <span className="text-xs font-semibold text-red-600">{formatCurrency(inv.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Automation Status */}
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={15} style={{ color: '#015035' }} />
                <h3 className="font-semibold text-gray-800 text-sm">Automation</h3>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Contract follow-up', status: 'Running', color: 'text-emerald-600' },
                  { label: 'Invoice reminders', status: 'Running', color: 'text-emerald-600' },
                  { label: 'Renewal alerts (90d)', status: 'Triggered', color: 'text-orange-500' },
                  { label: 'Project kickoff flow', status: 'Queued', color: 'text-blue-500' },
                ].map(a => (
                  <div key={a.label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">{a.label}</span>
                    <span className={`text-[11px] font-semibold ${a.color}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="metric-card">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Quick Stats</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">ARR</span>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(m.mrr * 12)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Avg Invoice</span>
                  <span className="text-xs font-bold text-gray-800">{formatCurrency(4671)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Collection Rate</span>
                  <span className="text-xs font-bold text-emerald-600">94%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Renewal Rate</span>
                  <span className="text-xs font-bold text-emerald-600">78%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Overdue Invoices</span>
                  <span className="text-xs font-bold text-red-500">{overdueInvoices.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
