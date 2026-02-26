import Header from '@/components/layout/Header'
import { maintenanceRecords } from '@/lib/data'
import { formatCurrency, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { RefreshCw, DollarSign, Calendar, AlertTriangle, CheckCircle } from 'lucide-react'

const statusColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  'Pending Cancellation': 'bg-red-100 text-red-600',
  Cancelled: 'bg-gray-100 text-gray-500',
}

const activeRecords = maintenanceRecords.filter(m => m.status === 'Active')
const totalMRR = activeRecords.reduce((s, m) => s + m.monthlyFee, 0)
const totalARR = totalMRR * 12

export default function MaintenancePage() {
  return (
    <>
      <Header title="Maintenance" subtitle="Recurring services and monthly retainers" action={{ label: 'Add Record' }} />
      <div className="p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Clients', value: activeRecords.length.toString(), icon: <CheckCircle size={16} />, color: '#22c55e' },
            { label: 'Monthly Recurring', value: formatCurrency(totalMRR), icon: <RefreshCw size={16} />, color: '#015035' },
            { label: 'Annual Recurring', value: formatCurrency(totalARR), icon: <DollarSign size={16} />, color: '#8b5cf6' },
            { label: 'Pending Cancel', value: maintenanceRecords.filter(m => m.status === 'Pending Cancellation').length.toString(), icon: <AlertTriangle size={16} />, color: '#ef4444' },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-0.5" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{m.label}</p>
            </div>
          ))}
        </div>

        {/* MRR visualization */}
        <div className="metric-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Monthly Recurring Revenue Breakdown</h3>
            <span className="text-xs text-gray-400">Total: {formatCurrency(totalMRR)}/mo</span>
          </div>
          <div className="flex flex-col gap-3">
            {activeRecords.map(rec => (
              <div key={rec.id}>
                <div className="flex justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{rec.company}</span>
                    <StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} />
                  </div>
                  <span className="font-bold text-gray-900">{formatCurrency(rec.monthlyFee)}/mo</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${(rec.monthlyFee / totalMRR) * 100}%`, background: '#015035' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">All Maintenance Records</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-left py-2.5 px-4 font-semibold">Monthly Fee</th>
                <th className="text-left py-2.5 px-4 font-semibold">Duration</th>
                <th className="text-left py-2.5 px-4 font-semibold">Start Date</th>
                <th className="text-left py-2.5 px-4 font-semibold">Next Billing</th>
                <th className="text-left py-2.5 px-4 font-semibold">Cancel Window</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRecords.map(rec => (
                <tr key={rec.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-gray-900">{rec.company}</p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={rec.serviceType} colorClass={serviceTypeColors[rec.serviceType]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={rec.status} colorClass={statusColors[rec.status]} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                      {formatCurrency(rec.monthlyFee)}
                    </span>
                    <span className="text-xs text-gray-400">/mo</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600">{rec.contractDuration} months</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{formatDate(rec.startDate)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-600 font-medium">{formatDate(rec.nextBillingDate)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{rec.cancellationWindow} days</span>
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
