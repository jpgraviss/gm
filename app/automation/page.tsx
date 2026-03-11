'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Zap, CheckCircle, Clock, AlertCircle, Play, Pause, X, Plus, ChevronRight, ArrowRight } from 'lucide-react'

type AutoStatus = 'Active' | 'Triggered' | 'Paused'

interface Automation {
  id: string
  name: string
  trigger: string
  actions: string[]
  status: AutoStatus
  runs: number
  lastRun: string
}


const statusConfig: Record<AutoStatus, { badge: string; icon: React.ReactNode; dot: string }> = {
  Active:    { badge: 'bg-green-100 text-green-700',   icon: <CheckCircle size={12} className="text-green-500" />,  dot: '#015035' },
  Triggered: { badge: 'bg-orange-100 text-orange-700', icon: <AlertCircle size={12} className="text-orange-500" />, dot: '#f97316' },
  Paused:    { badge: 'bg-gray-100 text-gray-500',     icon: <Pause size={12} className="text-gray-400" />,         dot: '#9ca3af' },
}

const TRIGGER_OPTIONS = [
  'Proposal Accepted', 'Proposal Declined', 'Contract Fully Executed',
  'Contract Sent', 'Invoice Paid', 'Invoice Overdue', 'Invoice Overdue by 3 Days',
  'Project Status = Launched', 'Renewal Date Within 90 Days',
  'Renewal Date Within 30 Days', 'Deal Stage Changed', 'Contact Created',
]

const ACTION_OPTIONS = [
  'Create Draft Contract', 'Create Billing Task', 'Create Project Record',
  'Create Maintenance Record', 'Create Renewal Task', 'Notify Sales Rep',
  'Notify Finance Team', 'Notify Delivery Team', 'Notify Assigned Rep',
  'Send Email Reminder', 'Send Follow-up Email', 'Log Activity',
  'Log Touchpoint', 'Flag in Dashboard', 'Update Revenue Metrics',
  'Apply Service Template', 'Update Client Portal', 'Escalate if 7+ Days',
]

// ─── New Automation Panel ─────────────────────────────────────────────────────

function NewAutomationPanel({ onSave, onClose }: { onSave: (a: Automation) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [actions, setActions] = useState<string[]>([''])

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
      actions: actions.filter(a => a.trim()),
      status: 'Active',
      runs: 0,
      lastRun: 'Never',
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
  const [automations, setAutomations] = useState<Automation[]>([])
  const [creatingAutomation, setCreatingAutomation] = useState(false)

  useEffect(() => {
    fetch('/api/automations').then(r => r.json()).then(setAutomations).catch(() => {})
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
  }

  const active = automations.filter(a => a.status === 'Active').length
  const triggered = automations.filter(a => a.status === 'Triggered').length
  const totalRuns = automations.reduce((s, a) => s + a.runs, 0)
  const paused = automations.filter(a => a.status === 'Paused').length

  return (
    <>
      <Header
        title="Automation Engine"
        subtitle="Triggers, actions, and workflow automation"
        action={{ label: 'New Automation', onClick: () => setCreatingAutomation(true) }}
      />
      <div className="p-3 sm:p-6 flex-1">

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Automations', value: active.toString(), icon: <Play size={16} />, color: '#015035' },
            { label: 'Triggered Today', value: triggered.toString(), icon: <Zap size={16} />, color: '#f59e0b' },
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
                      onClick={() => toggleStatus(auto.id)}
                      className={`p-1.5 rounded-lg transition-colors ${auto.status === 'Paused' ? 'hover:bg-green-50' : 'hover:bg-gray-100'}`}
                      title={auto.status === 'Paused' ? 'Resume automation' : 'Pause automation'}
                    >
                      {auto.status === 'Paused'
                        ? <Play size={14} className="text-emerald-500" />
                        : <Pause size={14} className="text-gray-400" />}
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
        <NewAutomationPanel onSave={handleNewAutomation} onClose={() => setCreatingAutomation(false)} />
      )}
    </>
  )
}
