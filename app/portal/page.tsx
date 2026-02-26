import Header from '@/components/layout/Header'
import { projects, contracts, renewals } from '@/lib/data'
import { formatCurrency, projectStatusColors, serviceTypeColors, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import { Globe, Lock, Eye, CheckCircle, Calendar, RefreshCw, FolderKanban } from 'lucide-react'

// Simulate a client view — Coastal Realty
const clientCompany = 'Coastal Realty'
const clientProject = projects.find(p => p.company === clientCompany)
const clientContract = contracts.find(c => c.company === clientCompany)
const clientRenewal = renewals.find(r => r.company === clientCompany)

export default function PortalPage() {
  return (
    <>
      <Header title="Client Portal" subtitle="Client-facing view configuration and access" action={{ label: 'Invite Client' }} />
      <div className="p-6 flex-1">

        {/* Portal Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Client Accounts', value: '3', icon: <Globe size={16} />, color: '#015035' },
            { label: 'Portal Logins This Month', value: '12', icon: <Eye size={16} />, color: '#3b82f6' },
            { label: 'Invitations Pending', value: '2', icon: <Lock size={16} />, color: '#f59e0b' },
          ].map(m => (
            <div key={m.label} className="metric-card flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs text-gray-500 font-medium">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Client Portal Preview */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Portal Preview — {clientCompany}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Preview Mode</span>
          </div>

          {/* Simulated client portal */}
          <div className="rounded-2xl overflow-hidden border-2 border-gray-200 shadow-lg">
            {/* Client portal header */}
            <div className="p-5 flex items-center justify-between" style={{ background: '#012b1e' }}>
              <div>
                <p className="text-white/60 text-xs">Welcome back,</p>
                <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  {clientCompany}
                </h2>
              </div>
              <div className="text-white/40 text-xs text-right">
                <p>Powered by</p>
                <p className="text-white font-bold tracking-widest">GravHub</p>
              </div>
            </div>

            <div className="p-5 bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Active Project */}
              {clientProject && (
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FolderKanban size={15} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Active Project</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{clientProject.serviceType} Project</p>
                  <StatusBadge label={clientProject.status} colorClass={projectStatusColors[clientProject.status]} />
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-semibold text-gray-800">{clientProject.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${clientProject.progress}%`, background: '#015035' }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {clientProject.milestones.slice(0, 3).map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${m.completed ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                          {m.completed && <span className="text-white text-[7px] font-bold">✓</span>}
                        </div>
                        <span className={`text-xs ${m.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contract Summary */}
              {clientContract && (
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle size={15} style={{ color: '#015035' }} />
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Contract</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{clientContract.serviceType} Agreement</p>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge label={clientContract.status} colorClass="bg-green-100 text-green-700" />
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Contract Value</span>
                      <span className="font-bold text-gray-900">{formatCurrency(clientContract.value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Start Date</span>
                      <span className="font-medium text-gray-700">{formatDate(clientContract.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Billing</span>
                      <span className="font-medium text-gray-700 text-right max-w-24 truncate">{clientContract.billingStructure}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Renewal Info */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw size={15} style={{ color: '#015035' }} />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Renewal</p>
                </div>
                {clientContract && (
                  <>
                    <p className="text-sm font-semibold text-gray-900 mb-1">Contract Renewal</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-600">{formatDate(clientContract.renewalDate)}</span>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-700 font-medium">Your account renews in 354 days. Your account manager will reach out 90 days before renewal.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Client Portal Accounts</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-semibold">Company</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service</th>
                <th className="text-left py-2.5 px-4 font-semibold">Portal Access</th>
                <th className="text-left py-2.5 px-4 font-semibold">Last Login</th>
                <th className="text-left py-2.5 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { company: 'Coastal Realty', service: 'Website', access: 'Active', lastLogin: '2 days ago' },
                { company: 'BlueStar Logistics', service: 'SEO', access: 'Active', lastLogin: '1 week ago' },
                { company: 'Harvest Foods', service: 'Email Marketing', access: 'Active', lastLogin: '3 days ago' },
                { company: 'Apex Solutions', service: 'Website', access: 'Invited', lastLogin: 'Never' },
                { company: 'Summit Capital', service: 'Custom', access: 'Not Setup', lastLogin: 'Never' },
              ].map(client => (
                <tr key={client.company} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <p className="text-sm font-semibold text-gray-900">{client.company}</p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge label={client.service} colorClass={serviceTypeColors[client.service as keyof typeof serviceTypeColors]} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      label={client.access}
                      colorClass={
                        client.access === 'Active' ? 'bg-green-100 text-green-700' :
                        client.access === 'Invited' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-500">{client.lastLogin}</span>
                  </td>
                  <td className="py-3 px-4">
                    {client.access === 'Active' && (
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View Portal</button>
                    )}
                    {client.access === 'Invited' && (
                      <button className="text-xs text-orange-600 hover:text-orange-700 font-medium">Resend Invite</button>
                    )}
                    {client.access === 'Not Setup' && (
                      <button className="text-xs text-gray-600 hover:text-gray-700 font-medium">Setup Access</button>
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
