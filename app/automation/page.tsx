'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Zap, CheckCircle, Clock, AlertCircle, Play, Pause, X, Plus, ChevronRight, ArrowRight, GitBranch, FileText, Inbox, ArrowRightLeft, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'

type AutoStatus = 'Active' | 'Triggered' | 'Paused'

interface Automation {
  id: string
  name: string
  trigger: string
  actions: { type: string; config: Record<string, unknown> }[]
  config?: Record<string, unknown>
  status: AutoStatus
  runs: number
  lastRun: string
  successRate: number | null
  failedRuns: number
}


const statusConfig: Record<AutoStatus, { badge: string; icon: React.ReactNode; dot: string }> = {
  Active:    { badge: 'bg-green-100 text-green-700',   icon: <CheckCircle size={12} className="text-green-500" />,  dot: '#015035' },
  Triggered: { badge: 'bg-orange-100 text-orange-700', icon: <AlertCircle size={12} className="text-orange-500" />, dot: '#f97316' },
  Paused:    { badge: 'bg-gray-100 text-gray-500',     icon: <Pause size={12} className="text-gray-400" />,         dot: '#9ca3af' },
}

// Only triggers that something in the app actually fires (see TRIGGER_MAP
// and fireAutomations()/fireTrigger() call sites in lib/automations-engine.ts
// and lib/automation-triggers.ts). Options previously listed here that
// nothing ever fires ("Invoice Overdue by 3 Days", "Project Status =
// Launched", "Deal Created", "Ticket Created", "Client Onboarded",
// "Milestone Completed") were removed — automations built against them
// would sit at "Active" with runs: 0 forever, looking healthy while being
// completely inert.
const TRIGGER_OPTIONS = [
  'Proposal Accepted', 'Proposal Declined', 'Contract Fully Executed',
  'Contract Sent', 'Invoice Paid', 'Invoice Overdue',
  'Renewal Date Within 90 Days', 'Renewal Date Within 30 Days',
  'Deal Stage Changed', 'Contact Created', 'Form Submitted',
]

// Only actions with a matching case in executeAction() (lib/automations-engine.ts).
// "Create Welcome Task", "Create CRM Contact", "Send Welcome Sequence", and
// "Notify Client" were removed — they had no implementation and silently
// no-op'd (hit the switch's default case), including inside 3 of the
// built-in templates below.
const ACTION_OPTIONS = [
  'Create Draft Contract', 'Create Billing Task', 'Create Project Record',
  'Create Maintenance Record', 'Create Renewal Task', 'Notify Sales Rep',
  'Notify Finance Team', 'Notify Delivery Team', 'Notify Assigned Rep',
  'Send Email Reminder', 'Send Follow-up Email', 'Log Activity',
  'Log Touchpoint', 'Flag in Dashboard', 'Update Revenue Metrics',
  'Apply Service Template', 'Update Client Portal', 'Escalate if 7+ Days',
  'Send Notification', 'Create Task', 'Generate Proposal',
]

// ─── Automation Templates ────────────────────────────────────────────────────

interface AutomationTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  trigger: string
  actions: string[]
}

// Four templates were removed here (New Deal Welcome, Project Milestone
// Complete, Ticket Submitted, Client Onboarded) — each relied on a trigger
// ("Deal Created", "Milestone Completed", "Ticket Created", "Client
// Onboarded") that nothing in the app ever fires, so they'd sit at "Active"
// forever and never run. See TRIGGER_OPTIONS above for what's real.
const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'invoice_overdue_reminder',
    name: 'Invoice Overdue Reminder',
    description: 'Send a reminder email when an invoice is overdue.',
    icon: <Clock size={20} />,
    trigger: 'Invoice Overdue',
    actions: ['Send Email Reminder'],
  },
  {
    id: 'contract_expiring_soon',
    name: 'Contract Expiring Soon',
    description: 'Create a renewal task when a contract is within 30 days of expiring.',
    icon: <FileText size={20} />,
    trigger: 'Renewal Date Within 30 Days',
    actions: ['Create Renewal Task', 'Notify Assigned Rep'],
  },
  {
    id: 'new_form_submission',
    name: 'New Form Submission',
    description: 'Notify sales when a form is submitted.',
    icon: <Inbox size={20} />,
    trigger: 'Form Submitted',
    actions: ['Notify Sales Rep'],
  },
  {
    id: 'proposal_accepted_followup',
    name: 'Proposal Accepted Follow-up',
    description: 'Draft a contract and notify finance when a proposal is accepted.',
    icon: <ArrowRightLeft size={20} />,
    trigger: 'Proposal Accepted',
    actions: ['Create Draft Contract', 'Notify Finance Team'],
  },
]

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'just now'
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── New Automation Panel ─────────────────────────────────────────────────────

function NewAutomationPanel({ onSave, onClose, initialName, initialTrigger, initialActions }: {
  onSave: (a: Automation) => void
  onClose: () => void
  initialName?: string
  initialTrigger?: string
  initialActions?: string[]
}) {
  const [name, setName] = useState(initialName ?? '')
  const [trigger, setTrigger] = useState(initialTrigger ?? '')
  const [actions, setActions] = useState<string[]>(initialActions && initialActions.length > 0 ? initialActions : [''])
  // "Form Submitted" fires for every form in the app by default (nothing
  // scopes it otherwise) — a client-specific automation like Generate
  // Proposal needs to be pinned to the one intake form it's meant for, not
  // every lead-capture/contact form too. Neither this panel nor the
  // drag-and-drop builder exposed that before; SequenceAutomateTab was the
  // only caller that ever set it, via its own bespoke code path.
  const [forms, setForms] = useState<{ id: string; name: string }[]>([])
  const [formId, setFormId] = useState('')

  useEffect(() => {
    if (trigger !== 'Form Submitted') return
    fetch('/api/forms')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setForms((Array.isArray(data) ? data : (data.items ?? [])).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))))
      .catch(() => {})
  }, [trigger])

  function addAction() { setActions(prev => [...prev, '']) }
  function removeAction(i: number) { setActions(prev => prev.filter((_, idx) => idx !== i)) }
  function setAction(i: number, val: string) { setActions(prev => prev.map((a, idx) => idx === i ? val : a)) }

  const canSave = name.trim() && trigger && actions.some(a => a.trim())

  function save() {
    if (!canSave) return
    onSave({
      id: `auto-${Date.now()}`,
      name: name.trim(),
      trigger,
      actions: actions.filter(a => a.trim()).map(type => ({ type, config: {} })),
      config: trigger === 'Form Submitted' && formId ? { formScope: 'specific', formId } : {},
      status: 'Active',
      runs: 0,
      lastRun: 'Never',
      successRate: null,
      failedRuns: 0,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base">New Automation</h2>
            <p className="text-white/50 text-xs mt-0.5">Define a trigger and one or more actions</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Automation Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Deal → Notify Team"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">WHEN</span>
                Trigger Event
              </span>
            </label>
            <select
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Select trigger...</option>
              {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {trigger === 'Form Submitted' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Which Form</label>
              <select
                value={formId}
                onChange={e => setFormId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Any form (fires for every form submission)</option>
                {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Pin this to one intake form, e.g. for Generate Proposal — otherwise it fires for every form in the app.</p>
            </div>
          )}

          {/* Arrow connector */}
          {trigger && (
            <div className="flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <div className="w-px h-4 bg-gray-300" />
                <ArrowRight size={16} className="text-gray-400 rotate-90" />
                <div className="w-px h-4 bg-gray-300" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">THEN</span>
                  Actions
                </span>
              </label>
              <button onClick={addAction} className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800">
                <Plus size={12} /> Add Action
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4 text-center font-semibold flex-shrink-0">{i + 1}.</span>
                  <select
                    value={action}
                    onChange={e => setAction(i, e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select action...</option>
                    {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {actions.length > 1 && (
                    <button onClick={() => removeAction(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            Create Automation
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { toast } = useToast()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [creatingAutomation, setCreatingAutomation] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<AutomationTemplate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/automations').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setAutomations(d) }).catch(() => toast('Failed to load automations', 'error')).finally(() => setLoading(false))
  }, [])

  async function toggleStatus(id: string) {
    const a = automations.find(x => x.id === id)
    if (!a) return
    const newStatus: AutoStatus = a.status === 'Paused' ? 'Active' : 'Paused'
    setAutomations(prev => prev.map(x => x.id === id ? { ...x, status: newStatus } : x))
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function deleteAutomation(id: string) {
    if (!confirm('Delete this automation? This cannot be undone.')) return
    const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAutomations(prev => prev.filter(a => a.id !== id))
      toast('Automation deleted', 'success')
    } else {
      toast('Failed to delete automation', 'error')
    }
  }

  async function handleNewAutomation(automation: Automation) {
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(automation),
    })
    if (res.ok) {
      const saved = await res.json()
      setAutomations(prev => [saved, ...prev])
    }
    setCreatingAutomation(false)
    setActiveTemplate(null)
  }

  const active = automations.filter(a => a.status === 'Active').length
  const totalRuns = automations.reduce((s, a) => s + (a.runs ?? 0), 0)
  const totalFailed = automations.reduce((s, a) => s + (a.failedRuns ?? 0), 0)
  const overallSuccessRate = totalRuns > 0 ? Math.round(((totalRuns - totalFailed) / totalRuns) * 100) : 100
  const paused = automations.filter(a => a.status === 'Paused').length

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header
        title="Automation Engine"
        subtitle="Triggers, actions, and workflow automation"
        action={{ label: 'New Automation', onClick: () => { setActiveTemplate(null); setCreatingAutomation(true) } }}
      />
      <div className="p-3 sm:p-6 flex-1">
        <div className="flex items-center justify-end mb-4">
          <Link
            href="/automation/builder"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            <GitBranch size={15} />
            Create Workflow
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Automations', value: active.toString(), icon: <Play size={16} />, color: '#015035' },
            { label: 'Success Rate', value: `${overallSuccessRate}%`, icon: <Zap size={16} />, color: '#f59e0b' },
            { label: 'Total Runs', value: totalRuns.toString(), icon: <CheckCircle size={16} />, color: '#3b82f6' },
            { label: 'Paused', value: paused.toString(), icon: <Pause size={16} />, color: '#9ca3af' },
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

        {/* Templates */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} style={{ color: '#015035' }} />
            <h3 className="text-sm font-bold text-gray-900">Quick Start Templates</h3>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Pre-built workflows</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {AUTOMATION_TEMPLATES.map(template => (
              <div
                key={template.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#01503512' }}
                  >
                    <span style={{ color: '#015035' }}>{template.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{template.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveTemplate(template); setCreatingAutomation(true) }}
                  className="w-full py-2 rounded-lg text-xs font-semibold transition-colors border hover:bg-emerald-50"
                  style={{ borderColor: '#015035', color: '#015035' }}
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Automation Cards */}
        <div className="flex flex-col gap-3">
          {automations.map(auto => {
            const cfg = statusConfig[auto.status]
            return (
              <div key={auto.id} className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${auto.status === 'Paused' ? 'border-gray-200 opacity-75' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${cfg.dot}18` }}
                    >
                      <Zap size={16} style={{ color: cfg.dot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{auto.name}</p>
                        <span className={`status-badge flex items-center gap-1 ${cfg.badge}`}>
                          {cfg.icon} {auto.status}
                        </span>
                      </div>

                      {/* Trigger → Actions flow */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 flex-shrink-0">
                          <Clock size={11} className="text-blue-500" />
                          <span className="text-[11px] font-semibold text-blue-700">WHEN: {auto.trigger}</span>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {auto.actions.map((action, i) => (
                            <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                              <span className="text-[11px] text-gray-600">{action.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <p className="text-xs text-gray-500 font-medium">{auto.runs ?? 0} runs</p>
                        {auto.successRate != null && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${auto.successRate >= 90 ? 'bg-green-50 text-green-700' : auto.successRate >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            {auto.successRate}%
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {auto.lastRun && auto.lastRun !== 'Never'
                          ? `Last: ${formatRelative(auto.lastRun)}`
                          : 'No runs yet'}
                      </p>
                      {(auto.failedRuns ?? 0) > 0 && (
                        <p className="text-[10px] text-red-500">{auto.failedRuns} failed</p>
                      )}
                    </div>
                    <Link
                      href={`/automation/builder?id=${auto.id}`}
                      className="p-1.5 rounded-lg transition-colors hover:bg-emerald-50"
                      title="Visual Editor"
                    >
                      <GitBranch size={14} style={{ color: '#015035' }} />
                    </Link>
                    <button
                      onClick={() => toggleStatus(auto.id)}
                      className={`p-1.5 rounded-lg transition-colors ${auto.status === 'Paused' ? 'hover:bg-green-50' : 'hover:bg-gray-100'}`}
                      title={auto.status === 'Paused' ? 'Resume automation' : 'Pause automation'}
                    >
                      {auto.status === 'Paused'
                        ? <Play size={14} className="text-emerald-500" />
                        : <Pause size={14} className="text-gray-400" />}
                    </button>
                    <button
                      onClick={() => deleteAutomation(auto.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                      title="Delete automation"
                    >
                      <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
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

      {creatingAutomation && (
        <NewAutomationPanel
          key={activeTemplate?.id ?? 'new'}
          onSave={handleNewAutomation}
          onClose={() => { setCreatingAutomation(false); setActiveTemplate(null) }}
          initialName={activeTemplate?.name}
          initialTrigger={activeTemplate?.trigger}
          initialActions={activeTemplate?.actions}
        />
      )}
    </>
  )
}
