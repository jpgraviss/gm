'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Zap, ChevronLeft } from 'lucide-react'
import { fetchTeamMembers } from '@/lib/supabase'
import type { TeamMember, OccupationalUnit } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'

const ROTATION_UNITS: OccupationalUnit[] = ['Sales', 'Delivery/Operations', 'Billing/Finance']

interface Automation {
  id: string
  name: string
  trigger: string
  actions: { type: string; config: Record<string, unknown> }[]
  config: {
    sequenceId?: string
    formScope?: 'any' | 'specific'
    formId?: string
    formName?: string
    senderType?: 'contact_owner' | 'specific_user'
    senderUserId?: string
    unit?: string
  }
  status: string
}

interface FormOption {
  id: string
  name: string
}

function CreateAutomationModal({
  sequenceId,
  onCreated,
  onClose,
}: {
  sequenceId: string
  onCreated: (a: Automation) => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const [step, setStep] = useState<'trigger' | 'action'>('trigger')
  const [formScope, setFormScope] = useState<'any' | 'specific'>('any')
  const [forms, setForms] = useState<FormOption[]>([])
  const [formId, setFormId] = useState('')
  const [action, setAction] = useState<'Enroll in Sequence' | 'Unenroll from Sequence'>('Enroll in Sequence')
  const [senderType, setSenderType] = useState<'contact_owner' | 'specific_user'>('contact_owner')
  const [senderUserId, setSenderUserId] = useState('')
  const [rotateFirst, setRotateFirst] = useState(false)
  const [rotateUnit, setRotateUnit] = useState<OccupationalUnit>('Sales')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/forms')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setForms((Array.isArray(data) ? data : (data.items ?? [])).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))))
      .catch(() => {})
    fetchTeamMembers().then(setTeamMembers).catch(() => {})
  }, [])

  async function save() {
    if (formScope === 'specific' && !formId) return
    if (action === 'Enroll in Sequence' && senderType === 'specific_user' && !senderUserId) return
    setSaving(true)
    const formName = forms.find(f => f.id === formId)?.name
    const triggerLabel = formScope === 'any' ? 'any form' : `"${formName}"`
    const actions = rotateFirst && action === 'Enroll in Sequence' ? ['Rotate Contact Owner', action] : [action]
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Form submission (${triggerLabel}) → ${actions.join(' → ')}`,
          trigger: 'Form Submitted',
          actions,
          status: 'Active',
          config: {
            sequenceId,
            formScope,
            formId: formScope === 'specific' ? formId : undefined,
            formName: formScope === 'specific' ? formName : undefined,
            senderType: action === 'Enroll in Sequence' ? senderType : undefined,
            senderUserId: action === 'Enroll in Sequence' && senderType === 'specific_user' ? senderUserId : undefined,
            unit: actions.includes('Rotate Contact Owner') ? rotateUnit : undefined,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      onCreated(created)
      toast('Automation created', 'success')
    } catch {
      toast('Failed to create automation', 'error')
    } finally {
      setSaving(false)
    }
  }

  const selectCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'action' && (
              <button onClick={() => setStep('trigger')} className="p-1 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={16} className="text-gray-400" />
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900">{step === 'trigger' ? 'Choose a trigger' : 'Choose an action'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {step === 'trigger' ? (
            <>
              <p className="text-xs text-gray-500">Enroll or unenroll contacts in this sequence when they submit a form.</p>
              <div>
                <label className={labelCls}>Form submission</label>
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer">
                    <input type="radio" checked={formScope === 'any'} onChange={() => setFormScope('any')} className="accent-emerald-600" />
                    <span className="text-sm text-gray-700">Contact submits any form</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer">
                    <input type="radio" checked={formScope === 'specific'} onChange={() => setFormScope('specific')} className="accent-emerald-600" />
                    <span className="text-sm text-gray-700">Contact submits a specific form</span>
                  </label>
                </div>
              </div>
              {formScope === 'specific' && (
                <select value={formId} onChange={e => setFormId(e.target.value)} className={selectCls}>
                  <option value="">Select a form…</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Sequence action</label>
                <div className="flex flex-col gap-2 mt-1">
                  {(['Enroll in Sequence', 'Unenroll from Sequence'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAction(a)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                        action === a ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Zap size={14} /> {a}
                    </button>
                  ))}
                </div>
              </div>
              {action === 'Enroll in Sequence' && (
                <>
                  <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={rotateFirst} onChange={e => setRotateFirst(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
                      <span className="text-sm font-medium text-gray-700">Round-robin assign the contact&apos;s owner first</span>
                    </label>
                    {rotateFirst && (
                      <select value={rotateUnit} onChange={e => setRotateUnit(e.target.value as OccupationalUnit)} className={`${selectCls} mt-3`}>
                        {ROTATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Sender</label>
                    <select value={senderType} onChange={e => setSenderType(e.target.value as 'contact_owner' | 'specific_user')} className={selectCls}>
                      <option value="contact_owner">Contact owner (the rep assigned to this contact)</option>
                      <option value="specific_user">Specific user</option>
                    </select>
                    {senderType === 'specific_user' && (
                      <select value={senderUserId} onChange={e => setSenderUserId(e.target.value)} className={`${selectCls} mt-2`}>
                        <option value="">Select a user…</option>
                        {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                    {rotateFirst && senderType === 'contact_owner' && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Will send from whoever round-robin just assigned.</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          {step === 'trigger' ? (
            <button
              onClick={() => setStep('action')}
              disabled={formScope === 'specific' && !formId}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              Next: Choose action
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving || (action === 'Enroll in Sequence' && senderType === 'specific_user' && !senderUserId)}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SequenceAutomateTab({ sequenceId }: { sequenceId: string }) {
  const { toast } = useToast()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch('/api/automations')
      .then(r => r.ok ? r.json() : [])
      .then((data: Automation[]) => {
        if (Array.isArray(data)) setAutomations(data.filter(a => a.config?.sequenceId === sequenceId))
      })
      .catch(() => toast('Failed to load automations', 'error'))
      .finally(() => setLoading(false))
  }, [sequenceId, toast])

  async function toggleAutomation(a: Automation) {
    const nextStatus = a.status === 'Active' ? 'Paused' : 'Active'
    setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, status: nextStatus } : x))
    try {
      const res = await fetch(`/api/automations/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast('Failed to update automation', 'error')
      setAutomations(prev => prev.map(x => x.id === a.id ? a : x))
    }
  }

  async function deleteAutomation(id: string) {
    const previous = automations
    setAutomations(prev => prev.filter(a => a.id !== id))
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast('Automation removed', 'success')
    } catch {
      toast('Failed to remove automation', 'error')
      setAutomations(previous)
    }
  }

  function describeAutomation(a: Automation): string {
    const triggerDesc = a.config?.formScope === 'specific' && a.config?.formName
      ? `submits "${a.config.formName}"`
      : 'submits any form'
    const rotateDesc = a.actions.some(x => x.type === 'Rotate Contact Owner') ? `Assign owner (round-robin, ${a.config?.unit}) → ` : ''
    const actionDesc = a.actions.some(x => x.type === 'Enroll in Sequence')
      ? `Enroll them in this sequence${a.config?.senderType === 'contact_owner' ? ' (sent by their assigned rep)' : ''}`
      : 'Unenroll them from this sequence'
    return `When a contact ${triggerDesc} → ${rotateDesc}${actionDesc}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Automatic unenrollment</h3>
        <p className="text-xs text-gray-400 mb-3">Always on, can&apos;t be turned off.</p>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm text-gray-700">When a contact replies to any email → Unenroll the contact from this sequence</p>
            <p className="text-[11px] text-amber-600 mt-1">Only detected on Gmail-sent emails from a rep with a connected Gmail account. Sequences sending via Resend, or enrollments assigned to a rep without Gmail connected, won&apos;t auto-unenroll on reply yet.</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0 ml-3">ALWAYS ON</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mt-2">
          <p className="text-sm text-gray-700">On a hard email bounce → Unenroll and add to the suppression list</p>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0 ml-3">ALWAYS ON</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Custom automations</h3>
            <p className="text-xs text-gray-400 mt-0.5">Automatically start or end this sequence when a lead submits a form.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 flex-shrink-0"
            style={{ background: '#015035' }}
          >
            <Plus size={13} /> Create an automation
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
        ) : automations.length === 0 ? (
          <div className="text-center py-8">
            <Zap size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No custom automations yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {automations.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-700 min-w-0">{describeAutomation(a)}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleAutomation(a)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${a.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${a.status === 'Active' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button onClick={() => deleteAutomation(a.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAutomationModal
          sequenceId={sequenceId}
          onCreated={a => { setAutomations(prev => [...prev, a]); setShowCreate(false) }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
