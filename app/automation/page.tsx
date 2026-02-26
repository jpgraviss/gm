import Header from '@/components/layout/Header'
import { Zap, CheckCircle, Clock, AlertCircle, Play, Pause, Plus } from 'lucide-react'

const automations = [
  {
    id: 'auto1',
    name: 'Proposal Accepted → Generate Contract',
    trigger: 'Proposal Accepted',
    actions: ['Create Draft Contract', 'Notify Sales Rep', 'Log Activity'],
    status: 'Active',
    runs: 4,
    lastRun: '3 days ago',
  },
  {
    id: 'auto2',
    name: 'Contract Executed → Create Invoice Task',
    trigger: 'Contract Fully Executed',
    actions: ['Create Billing Task', 'Notify Finance Team', 'Update Revenue Metrics'],
    status: 'Active',
    runs: 3,
    lastRun: '5 days ago',
  },
  {
    id: 'auto3',
    name: 'Invoice Paid → Create Project',
    trigger: 'Invoice Paid',
    actions: ['Create Project Record', 'Apply Service Template', 'Notify Delivery Team'],
    status: 'Active',
    runs: 3,
    lastRun: '1 week ago',
  },
  {
    id: 'auto4',
    name: 'Renewal Window (90 days) → Notify Sales',
    trigger: 'Renewal Date Within 90 Days',
    actions: ['Notify Assigned Rep', 'Create Renewal Task', 'Flag in Dashboard'],
    status: 'Triggered',
    runs: 2,
    lastRun: '2 hours ago',
  },
  {
    id: 'auto5',
    name: 'Overdue Invoice → Send Reminder',
    trigger: 'Invoice Overdue by 3 Days',
    actions: ['Send Email Reminder', 'Notify Finance', 'Escalate if 7+ Days'],
    status: 'Active',
    runs: 8,
    lastRun: '1 day ago',
  },
  {
    id: 'auto6',
    name: 'Project Launched → Start Maintenance',
    trigger: 'Project Status = Launched',
    actions: ['Create Maintenance Record', 'Generate Monthly Invoice Task', 'Update Client Portal'],
    status: 'Active',
    runs: 2,
    lastRun: '2 weeks ago',
  },
  {
    id: 'auto7',
    name: 'Contract Sent → Follow-up After 3 Days',
    trigger: 'Contract Sent + 3 Days No Response',
    actions: ['Send Follow-up Email', 'Create Task for Rep', 'Log Touchpoint'],
    status: 'Paused',
    runs: 5,
    lastRun: '1 month ago',
  },
]

const triggerColors: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Triggered: 'bg-orange-100 text-orange-700',
  Paused: 'bg-gray-100 text-gray-500',
}

const triggerIcons: Record<string, React.ReactNode> = {
  Active: <CheckCircle size={12} className="text-green-500" />,
  Triggered: <AlertCircle size={12} className="text-orange-500" />,
  Paused: <Pause size={12} className="text-gray-400" />,
}

export default function AutomationPage() {
  return (
    <>
      <Header title="Automation Engine" subtitle="Triggers, actions, and workflow automation" action={{ label: 'New Automation' }} />
      <div className="p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Automations', value: automations.filter(a => a.status === 'Active').length.toString(), icon: <Play size={16} />, color: '#015035' },
            { label: 'Triggered Today', value: automations.filter(a => a.status === 'Triggered').length.toString(), icon: <Zap size={16} />, color: '#f59e0b' },
            { label: 'Total Runs', value: automations.reduce((s, a) => s + a.runs, 0).toString(), icon: <CheckCircle size={16} />, color: '#3b82f6' },
            { label: 'Paused', value: automations.filter(a => a.status === 'Paused').length.toString(), icon: <Pause size={16} />, color: '#9ca3af' },
          ].map(m => (
            <div key={m.label} className="metric-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${m.color}18` }}>
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{m.value}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Automation Cards */}
        <div className="flex flex-col gap-3">
          {automations.map(auto => (
            <div key={auto.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: auto.status === 'Active' ? '#e6f0ec' : auto.status === 'Triggered' ? '#fff7ed' : '#f5f5f5' }}
                  >
                    <Zap size={16} style={{ color: auto.status === 'Active' ? '#015035' : auto.status === 'Triggered' ? '#f97316' : '#9ca3af' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-sm font-semibold text-gray-900">{auto.name}</p>
                      <span className={`status-badge ${triggerColors[auto.status]}`}>
                        <span className="flex items-center gap-1">{triggerIcons[auto.status]} {auto.status}</span>
                      </span>
                    </div>

                    {/* Trigger → Actions flow */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1">
                        <Clock size={11} className="text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-700">WHEN: {auto.trigger}</span>
                      </div>
                      <span className="text-gray-300 text-sm">→</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {auto.actions.map((action, i) => (
                          <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                            <span className="text-[11px] text-gray-600">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{auto.runs} runs</p>
                    <p className="text-[10px] text-gray-400">Last: {auto.lastRun}</p>
                  </div>
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    title={auto.status === 'Paused' ? 'Resume' : 'Pause'}
                  >
                    {auto.status === 'Paused'
                      ? <Play size={14} className="text-gray-400" />
                      : <Pause size={14} className="text-gray-400" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Banner */}
        <div className="mt-6 p-4 rounded-xl border border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <Zap size={18} style={{ color: '#015035' }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#015035' }}>Automation Engine Active</p>
              <p className="text-xs text-green-700 mt-1">
                All active automations run in real-time. Triggers are evaluated on every status change, signature event, and payment confirmation. No manual handoffs are needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
