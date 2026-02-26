import Header from '@/components/layout/Header'
import { renewals } from '@/lib/data'
import { formatCurrency, serviceTypeColors, renewalStatusColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { AlertTriangle, Clock, CheckCircle, TrendingDown, Calendar, DollarSign } from 'lucide-react'

function UrgencyBar({ days }: { days: number }) {
  const pct = Math.max(0, Math.min(100, (days / 90) * 100))
  const color = days <= 14 ? '#ef4444' : days <= 30 ? '#f97316' : days <= 60 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${100 - pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {days <= 0 ? 'Expired!' : `${days}d`}
      </span>
    </div>
  )
}

const metrics = {
  expiring30: renewals.filter(r => r.daysUntilExpiry <= 30 && r.status !== 'Renewed').length,
  expiring60: renewals.filter(r => r.daysUntilExpiry <= 60 && r.status !== 'Renewed').length,
  expiring90: renewals.filter(r => r.daysUntilExpiry <= 90 && r.status !== 'Renewed').length,
  renewalValue: renewals.filter(r => r.status !== 'Churned').reduce((s, r) => s + r.renewalValue, 0),
}

export default function RenewalsPage() {
  const sorted = [...renewals].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  return (
    <>
      <Header title="Renewals" subtitle="Forecast and manage contract renewals" action={{ label: 'Log Renewal' }} />
      <div className="p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Expiring in 30d', value: metrics.expiring30.toString(), icon: <AlertTriangle size={16} />, color: '#ef4444', sub: 'Immediate action' },
            { label: 'Expiring in 60d', value: metrics.expiring60.toString(), icon: <Clock size={16} />, color: '#f97316', sub: 'Schedule calls' },
            { label: 'Expiring in 90d', value: metrics.expiring90.toString(), icon: <Calendar size={16} />, color: '#f59e0b', sub: 'On radar' },
            { label: 'Renewal Pipeline', value: formatCurrency(metrics.renewalValue), icon: <DollarSign size={16} />, color: '#015035', sub: 'At-risk ARR' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Renewal Timeline */}
        <div className="metric-card mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Renewal Forecast Timeline (Next 90 Days)</h3>
          <div className="relative">
            {/* Timeline bar */}
            <div className="flex gap-0 h-8 rounded-xl overflow-hidden mb-3">
              {['0-30d', '31-60d', '61-90d'].map((label, i) => (
                <div
                  key={label}
                  className="flex-1 flex items-center justify-center text-xs font-semibold text-white"
                  style={{
                    background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#f59e0b',
                    opacity: 0.85
                  }}
                >
                  {label}
                </div>
              ))}
              <div className="flex-1 flex items-center justify-center text-xs font-semibold text-gray-500 bg-gray-100">
                90d+
              </div>
            </div>
            {/* Deal dots */}
            <div className="flex flex-col gap-2">
              {sorted.filter(r => r.daysUntilExpiry <= 90).map(r => (
                <div key={r.id} className="flex items-center gap-3 text-sm">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: r.daysUntilExpiry <= 30 ? '#ef4444' : r.daysUntilExpiry <= 60 ? '#f97316' : '#f59e0b' }}
                  />
                  <span className="font-medium text-gray-800 w-36 truncate">{r.company}</span>
                  <StatusBadge label={r.serviceType} colorClass={serviceTypeColors[r.serviceType]} />
                  <span className="font-bold text-gray-700">{formatCurrency(r.renewalValue)}</span>
                  <span className="text-gray-400 text-xs ml-auto">{formatDate(r.expirationDate)}</span>
                  <UrgencyBar days={r.daysUntilExpiry} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Full Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-800">All Renewals</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> 0–30 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> 31–60 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> 61–90 days</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> 90+ days</div>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold">Value</th>
                <th className="text-left py-2.5 px-4 font-semibold">Expiration</th>
                <th className="text-left py-2.5 px-4 font-semibold">Urgency</th>
                <th className="text-left py-2.5 px-4 font-semibold">Rep</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-gray-900">{r.company}</p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={r.serviceType} colorClass={serviceTypeColors[r.serviceType]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={r.status} colorClass={renewalStatusColors[r.status]} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(r.renewalValue)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{formatDate(r.expirationDate)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <UrgencyBar days={r.daysUntilExpiry} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">{r.assignedRep}</span>
                  </td>
                  <td className="py-3 px-4">
                    {r.status === 'Upcoming' && (
                      <button className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100">
                        Start Renewal
                      </button>
                    )}
                    {r.status === 'In Progress' && (
                      <button className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-md hover:bg-orange-100">
                        Create Proposal
                      </button>
                    )}
                    {r.status === 'Renewed' && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={11} /> Renewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
