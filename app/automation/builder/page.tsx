'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Save, ChevronDown, Plus, MoreHorizontal,
  Zap, Mail, User, Briefcase, Tag,
  Clock, GitBranch, Bell, ListTodo, Activity, Trash2,
  X, Play, Pause, ZoomIn, ZoomOut, Maximize2,
  FileText, CheckCircle, ChevronRight, Check, AlertCircle, Loader2,
  Edit3, Copy,
} from 'lucide-react'

type TriggerType =
  | 'contact_created' | 'deal_stage_changed' | 'invoice_overdue'
  | 'contract_signed' | 'form_submitted'
  | 'proposal_accepted' | 'proposal_declined' | 'invoice_paid'

type ActionType =
  | 'send_email'
  | 'update_contact' | 'create_deal' | 'add_tag' | 'remove_tag'
  | 'create_task' | 'log_activity' | 'send_notification'
  | 'wait' | 'if_else'

interface WorkflowNode {
  id: string
  type: 'trigger' | 'action' | 'end'
  subtype?: TriggerType | ActionType
  config: Record<string, unknown>
  label: string
}

const TRIGGER_OPTIONS: { value: TriggerType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'contact_created',    label: 'Contact Created',      icon: <User size={18} />,       description: 'When a new contact is added to CRM' },
  { value: 'deal_stage_changed', label: 'Deal Stage Changed',   icon: <Briefcase size={18} />,  description: 'When a deal moves to a new stage' },
  { value: 'invoice_overdue',    label: 'Invoice Overdue',      icon: <Clock size={18} />,       description: 'When an invoice passes its due date' },
  { value: 'contract_signed',    label: 'Contract Signed',      icon: <FileText size={18} />,   description: 'When a contract is fully executed' },
  { value: 'form_submitted',     label: 'Form Submitted',       icon: <ListTodo size={18} />,   description: 'When a form submission is received' },
  { value: 'proposal_accepted',  label: 'Proposal Accepted',    icon: <CheckCircle size={18} />,description: 'When a proposal is accepted by client' },
  { value: 'proposal_declined',  label: 'Proposal Declined',    icon: <X size={18} />,          description: 'When a proposal is declined by client' },
  { value: 'invoice_paid',       label: 'Invoice Paid',         icon: <CheckCircle size={18} />,description: 'When a payment is received for an invoice' },
]

const ACTION_CATEGORIES: { label: string; actions: { value: ActionType; label: string; icon: React.ReactNode; description: string }[] }[] = [
  {
    label: 'Communication',
    actions: [
      { value: 'send_email',     label: 'Send Email',       icon: <Mail size={18} />,          description: 'Send an automated email' },
    ],
  },
  {
    label: 'CRM',
    actions: [
      { value: 'update_contact', label: 'Update Contact',   icon: <User size={18} />,       description: 'Update contact fields' },
      { value: 'create_deal',    label: 'Create Deal',      icon: <Briefcase size={18} />,  description: 'Create a new deal record' },
      { value: 'add_tag',        label: 'Add Tag',          icon: <Tag size={18} />,        description: 'Add a tag to the contact' },
      { value: 'remove_tag',     label: 'Remove Tag',       icon: <Tag size={18} />,        description: 'Remove a tag from the contact' },
    ],
  },
  {
    label: 'Internal',
    actions: [
      { value: 'create_task',       label: 'Create Task',       icon: <ListTodo size={18} />,  description: 'Create a task for the team' },
      { value: 'log_activity',      label: 'Log Activity',      icon: <Activity size={18} />,  description: 'Log an activity in the CRM' },
      { value: 'send_notification', label: 'Send Notification', icon: <Bell size={18} />,      description: 'Notify a team member' },
    ],
  },
  {
    label: 'Flow Control',
    actions: [
      { value: 'wait',    label: 'Wait / Delay',  icon: <Clock size={18} />,      description: 'Wait for a specified duration' },
      { value: 'if_else', label: 'If / Else',      icon: <GitBranch size={18} />,  description: 'Branch based on a condition' },
    ],
  },
]

const TRIGGER_TO_DB: Record<TriggerType, string> = {
  contact_created:    'Contact Created',
  deal_stage_changed: 'Deal Stage Changed',
  invoice_overdue:    'Invoice Overdue',
  contract_signed:    'Contract Fully Executed',
  form_submitted:     'Form Submitted',
  proposal_accepted:  'Proposal Accepted',
  proposal_declined:  'Proposal Declined',
  invoice_paid:       'Invoice Paid',
}

const ACTION_TO_DB: Record<ActionType, string> = {
  send_email:        'Send Email Reminder',
  update_contact:    'Update Contact',
  create_deal:       'Create Deal',
  add_tag:           'Add Tag',
  remove_tag:        'Remove Tag',
  create_task:       'Create Task',
  log_activity:      'Log Activity',
  send_notification: 'Send Notification',
  wait:              'Wait',
  if_else:           'If/Else',
}

function uid() {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function getTriggerMeta(subtype: TriggerType) {
  return TRIGGER_OPTIONS.find(t => t.value === subtype)
}

function getActionMeta(subtype: ActionType) {
  for (const cat of ACTION_CATEGORIES) {
    const found = cat.actions.find(a => a.value === subtype)
    if (found) return found
  }
  return null
}

// ─── Trigger Picker Modal ────────────────────────────────────────────────────

function TriggerPickerModal({ onSelect, onClose }: { onSelect: (t: TriggerType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Select a Trigger</h3>
            <p className="text-xs text-gray-500 mt-0.5">Choose what starts this workflow</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-3 max-h-[420px] overflow-y-auto">
          {TRIGGER_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => onSelect(t.value)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#01503510' }}>
                <span style={{ color: '#015035' }}>{t.icon}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Action Picker Modal ─────────────────────────────────────────────────────

function ActionPickerModal({ onSelect, onClose }: { onSelect: (a: ActionType) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Add an Action</h3>
            <p className="text-xs text-gray-500 mt-0.5">Choose what happens next in the workflow</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-3 max-h-[480px] overflow-y-auto">
          {ACTION_CATEGORIES.map(cat => (
            <div key={cat.label} className="mb-3 last:mb-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-1">{cat.label}</p>
              {cat.actions.map(a => (
                <button
                  key={a.value}
                  onClick={() => onSelect(a.value)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                    <span className="text-blue-600">{a.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                    <p className="text-xs text-gray-500">{a.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Node Config Panel ───────────────────────────────────────────────────────

function NodeConfigPanel({ node, onChange, onClose }: {
  node: WorkflowNode
  onChange: (config: Record<string, unknown>) => void
  onClose: () => void
}) {
  const config = node.config
  const update = (key: string, val: unknown) => onChange({ ...config, [key]: val })

  const renderFields = () => {
    if (node.type === 'trigger') {
      switch (node.subtype as TriggerType) {
        case 'deal_stage_changed':
          return (
            <>
              <FieldLabel label="Target Stage (optional)">
                <select value={(config.stage as string) ?? ''} onChange={e => update('stage', e.target.value)} className="cfg-input">
                  <option value="">Any stage</option>
                  {['Lead', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FieldLabel>
            </>
          )
        case 'invoice_overdue':
          return (
            <FieldLabel label="Overdue threshold">
              {/* A dropdown, not a free number input — the cron job behind
                  this trigger only ever checks two real checkpoints (the
                  invoice just went overdue, or it's been 3+ days), so any
                  other number here would silently never fire. */}
              <select
                value={config.overdueDays === undefined ? 'any' : String(config.overdueDays)}
                onChange={e => update('overdueDays', e.target.value === 'any' ? undefined : parseInt(e.target.value))}
                className="cfg-input"
              >
                <option value="any">Any (as soon as overdue, or 3+ days)</option>
                <option value="0">As soon as overdue</option>
                <option value="3">3+ days overdue</option>
              </select>
            </FieldLabel>
          )
        default:
          return <p className="text-xs text-gray-500 italic">No additional configuration needed.</p>
      }
    }

    switch (node.subtype as ActionType) {
      case 'send_email':
        return (
          <>
            <FieldLabel label="Subject Line">
              <input value={(config.subject as string) ?? ''} onChange={e => update('subject', e.target.value)} placeholder="e.g. Welcome to GravHub!" className="cfg-input" />
            </FieldLabel>
            <FieldLabel label="Email Body">
              <textarea rows={4} value={(config.body as string) ?? ''} onChange={e => update('body', e.target.value)} placeholder="Hi {{contact.name}}, ..." className="cfg-input resize-none" />
            </FieldLabel>
            <FieldLabel label="From Name">
              <input value={(config.fromName as string) ?? ''} onChange={e => update('fromName', e.target.value)} placeholder="GravHub" className="cfg-input" />
            </FieldLabel>
          </>
        )
      case 'wait':
        return (
          <>
            <FieldLabel label="Duration">
              <div className="flex gap-2">
                <input type="number" min={1} value={(config.duration as number) ?? 1} onChange={e => update('duration', parseInt(e.target.value) || 1)} className="cfg-input flex-1" />
                <select value={(config.unit as string) ?? 'hours'} onChange={e => update('unit', e.target.value)} className="cfg-input w-28">
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </FieldLabel>
          </>
        )
      case 'if_else':
        return (
          <>
            <FieldLabel label="Condition Field">
              <select value={(config.field as string) ?? ''} onChange={e => update('field', e.target.value)} className="cfg-input">
                <option value="">Select field...</option>
                <option value="deal_value">Deal Value</option>
                <option value="contact_tag">Contact Tag</option>
                <option value="deal_stage">Deal Stage</option>
                <option value="invoice_amount">Invoice Amount</option>
                <option value="company_name">Company Name</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Operator">
              <select value={(config.operator as string) ?? 'equals'} onChange={e => update('operator', e.target.value)} className="cfg-input">
                <option value="equals">Equals</option>
                <option value="not_equals">Does Not Equal</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Value">
              <input value={(config.value as string) ?? ''} onChange={e => update('value', e.target.value)} placeholder="Comparison value" className="cfg-input" />
            </FieldLabel>
          </>
        )
      case 'create_task':
        return (
          <>
            <FieldLabel label="Task Title">
              <input value={(config.title as string) ?? ''} onChange={e => update('title', e.target.value)} placeholder="Follow up with client" className="cfg-input" />
            </FieldLabel>
            <FieldLabel label="Assignee">
              <input value={(config.assignee as string) ?? ''} onChange={e => update('assignee', e.target.value)} placeholder="Team member name" className="cfg-input" />
            </FieldLabel>
            <FieldLabel label="Due Date Offset (days)">
              <input type="number" min={0} value={(config.dueDateOffset as number) ?? 1} onChange={e => update('dueDateOffset', parseInt(e.target.value) || 0)} className="cfg-input" />
            </FieldLabel>
          </>
        )
      case 'add_tag':
      case 'remove_tag':
        return (
          <FieldLabel label="Tag Name">
            <input value={(config.tag as string) ?? ''} onChange={e => update('tag', e.target.value)} placeholder="e.g. VIP, Hot Lead" className="cfg-input" />
          </FieldLabel>
        )
      case 'update_contact':
        return (
          <>
            <FieldLabel label="Field to Update">
              <select value={(config.field as string) ?? ''} onChange={e => update('field', e.target.value)} className="cfg-input">
                <option value="">Select field...</option>
                <option value="status">Status</option>
                <option value="lifecycle_stage">Lifecycle Stage</option>
                <option value="owner">Owner</option>
                <option value="source">Source</option>
              </select>
            </FieldLabel>
            <FieldLabel label="New Value">
              <input value={(config.value as string) ?? ''} onChange={e => update('value', e.target.value)} placeholder="New field value" className="cfg-input" />
            </FieldLabel>
          </>
        )
      case 'create_deal':
        return (
          <>
            <FieldLabel label="Deal Name Template">
              <input value={(config.dealName as string) ?? ''} onChange={e => update('dealName', e.target.value)} placeholder="New deal for {{contact.name}}" className="cfg-input" />
            </FieldLabel>
            <FieldLabel label="Pipeline Stage">
              <select value={(config.stage as string) ?? 'Lead'} onChange={e => update('stage', e.target.value)} className="cfg-input">
                {['Lead', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FieldLabel>
          </>
        )
      case 'log_activity':
        return (
          <FieldLabel label="Activity Note">
            <textarea rows={3} value={(config.note as string) ?? ''} onChange={e => update('note', e.target.value)} placeholder="What happened..." className="cfg-input resize-none" />
          </FieldLabel>
        )
      case 'send_notification':
        return (
          <>
            <FieldLabel label="Notify">
              <select value={(config.target as string) ?? ''} onChange={e => update('target', e.target.value)} className="cfg-input">
                <option value="">Select recipient...</option>
                <option value="assigned_rep">Assigned Rep</option>
                <option value="sales_team">Sales Team</option>
                <option value="finance_team">Finance Team</option>
                <option value="leadership">Leadership</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Message">
              <input value={(config.message as string) ?? ''} onChange={e => update('message', e.target.value)} placeholder="Notification message" className="cfg-input" />
            </FieldLabel>
          </>
        )
      default:
        return <p className="text-xs text-gray-500 italic">No configuration options.</p>
    }
  }

  const meta = node.type === 'trigger'
    ? getTriggerMeta(node.subtype as TriggerType)
    : getActionMeta(node.subtype as ActionType)

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-white border-l border-gray-200 flex flex-col h-full z-30 shadow-xl md:shadow-none md:static md:z-auto">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: node.type === 'trigger' ? '#01503512' : '#3b82f612' }}>
            <span style={{ color: node.type === 'trigger' ? '#015035' : '#3b82f6' }}>{meta?.icon}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{meta?.label ?? node.label}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{node.type === 'trigger' ? 'Trigger' : 'Action'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {renderFields()}
      </div>
    </div>
  )
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Workflow Node Component ─────────────────────────────────────────────────

function WorkflowNodeCard({ node, isSelected, onSelect, onDelete, onDuplicate }: {
  node: WorkflowNode
  isSelected: boolean
  onSelect: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (node.type === 'end') {
    return (
      <div className="flex flex-col items-center">
        <div className="w-32 py-2.5 rounded-xl border-2 border-gray-300 bg-gray-50 text-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">End</span>
        </div>
      </div>
    )
  }

  const isTrigger = node.type === 'trigger'
  const hasTrigger = !!node.subtype

  if (isTrigger && !hasTrigger) {
    return (
      <button
        onClick={onSelect}
        className="flex items-center gap-3 px-6 py-4 rounded-xl border-2 border-dashed transition-all hover:border-emerald-400 hover:bg-emerald-50/30"
        style={{ borderColor: isSelected ? '#015035' : '#d1d5db' }}
      >
        <div className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
          <Plus size={18} className="text-gray-400" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-gray-700">Add New Trigger</p>
          <p className="text-xs text-gray-400">Choose what starts this workflow</p>
        </div>
      </button>
    )
  }

  const meta = isTrigger
    ? getTriggerMeta(node.subtype as TriggerType)
    : getActionMeta(node.subtype as ActionType)

  const borderColor = isTrigger ? '#015035' : '#3b82f6'
  const bgAccent = isTrigger ? '#01503508' : '#3b82f608'
  const iconBg = isTrigger ? '#01503512' : '#3b82f612'

  return (
    <div
      className="relative group"
      style={{ width: 280 }}
    >
      <div
        onClick={onSelect}
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 bg-white cursor-pointer transition-all hover:shadow-md"
        style={{
          borderColor: isSelected ? borderColor : '#e5e7eb',
          background: isSelected ? bgAccent : '#fff',
        }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <span style={{ color: borderColor }}>{meta?.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: borderColor }}>
            {isTrigger ? 'Trigger' : 'Action'}
          </p>
          <p className="text-sm font-semibold text-gray-900 truncate">{meta?.label ?? node.label}</p>
        </div>

        {!isTrigger && (
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal size={14} className="text-gray-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-36">
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onSelect() }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Edit3 size={12} /> Configure
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onDuplicate?.() }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={12} /> Duplicate
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete?.() }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Connector Line + Add Button ─────────────────────────────────────────────

function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-5" style={{ background: '#d1d5db' }} />
      <button
        onClick={onAdd}
        className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-colors z-10"
      >
        <Plus size={13} className="text-gray-400" />
      </button>
      <div className="w-0.5 h-5" style={{ background: '#d1d5db' }} />
    </div>
  )
}

function StaticConnector() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-8" style={{ background: '#d1d5db' }} />
    </div>
  )
}

// ─── Minimap ─────────────────────────────────────────────────────────────────

function Minimap({ nodes, zoom }: { nodes: WorkflowNode[]; zoom: number }) {
  const nodeCount = nodes.length
  const totalHeight = nodeCount * 20 + (nodeCount - 1) * 8

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Minimap</p>
      <div className="relative bg-gray-50 rounded-lg border border-gray-100 p-2" style={{ height: Math.max(80, Math.min(totalHeight + 16, 200)) }}>
        <div className="flex flex-col items-center gap-1">
          {nodes.map(node => {
            let bg = '#d1d5db'
            if (node.type === 'trigger' && node.subtype) bg = '#015035'
            else if (node.type === 'action') bg = '#3b82f6'
            else if (node.type === 'end') bg = '#9ca3af'

            return (
              <div key={node.id} className="flex flex-col items-center">
                <div className="rounded" style={{ width: 32, height: 8, background: bg }} />
                {node.type !== 'end' && <div className="w-px h-1.5 bg-gray-300" />}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-[9px] text-gray-400 text-center mt-2">{Math.round(zoom * 100)}%</p>
    </div>
  )
}

// ─── Run Types & Helpers ────────────────────────────────────────────────────

interface RunStep {
  name: string
  status: 'success' | 'failed' | 'running' | 'pending' | 'skipped'
  duration_ms: number
  error?: string
}

interface WorkflowRun {
  id: string
  automation_id: string
  timestamp: string
  trigger_contact: { name: string; email: string }
  status: 'success' | 'failed' | 'running' | 'waiting'
  actions_completed: number
  actions_total: number
  steps: RunStep[]
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status }: { status: WorkflowRun['status'] }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
        <Check size={10} /> Success
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">
        <AlertCircle size={10} /> Failed
      </span>
    )
  }
  if (status === 'waiting') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
        <Clock size={10} /> Waiting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 animate-pulse">
      <Loader2 size={10} className="animate-spin" /> Running
    </span>
  )
}

function StepStatusIcon({ status }: { status: RunStep['status'] }) {
  if (status === 'success') return <Check size={14} className="text-emerald-600" />
  if (status === 'failed') return <AlertCircle size={14} className="text-red-600" />
  if (status === 'running') return <Loader2 size={14} className="text-blue-600 animate-spin" />
  if (status === 'skipped') return <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
  return <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />
}

function RunsTab({ automationId }: { automationId: string }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/automations/${automationId}/runs`)
      .then(r => r.ok ? r.json() : [])
      .then((data: WorkflowRun[]) => { if (!cancelled) setRuns(data) })
      .catch(() => { if (!cancelled) setRuns([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [automationId])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="text-gray-400 animate-spin" />
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Activity size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">No runs yet</p>
          <p className="text-xs text-gray-500">Publish this workflow to start collecting execution data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_1fr_100px_100px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Run ID</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Triggered by</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</p>
          </div>
          {runs.map(run => (
            <div key={run.id}>
              <button
                onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                className="w-full px-4 md:px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
              >
                <div className="hidden md:grid grid-cols-[1fr_120px_1fr_100px_100px] gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      size={14}
                      className={`text-gray-400 transition-transform ${expandedRunId === run.id ? 'rotate-90' : ''}`}
                    />
                    <code className="text-xs font-mono text-gray-700">{run.id.slice(0, 10)}</code>
                  </div>
                  <p className="text-xs text-gray-500">{relativeTime(run.timestamp)}</p>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{run.trigger_contact.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{run.trigger_contact.email}</p>
                  </div>
                  <StatusBadge status={run.status} />
                  <p className="text-xs text-gray-600 text-right font-medium">{run.actions_completed}/{run.actions_total} actions</p>
                </div>
                <div className="md:hidden flex items-start gap-3">
                  <ChevronRight
                    size={14}
                    className={`text-gray-400 transition-transform mt-1 flex-shrink-0 ${expandedRunId === run.id ? 'rotate-90' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-900 truncate">{run.trigger_contact.name}</p>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="text-[10px] text-gray-400">{relativeTime(run.timestamp)} &middot; {run.actions_completed}/{run.actions_total} actions</p>
                  </div>
                </div>
              </button>
              {expandedRunId === run.id && (
                <div className="px-5 pb-4 pt-1 bg-gray-50/50 border-b border-gray-100">
                  <div className="ml-6 space-y-1">
                    {run.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white border border-gray-100">
                        <StepStatusIcon status={step.status} />
                        <span className="text-sm text-gray-900 font-medium flex-1">{step.name}</span>
                        {step.duration_ms > 0 && (
                          <span className="text-[11px] text-gray-400 font-mono">{step.duration_ms}ms</span>
                        )}
                        {step.status === 'failed' && step.error && (
                          <span className="text-[11px] text-red-600 max-w-xs truncate" title={step.error}>{step.error}</span>
                        )}
                        {step.status === 'skipped' && (
                          <span className="text-[11px] text-gray-400">Skipped</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Builder Page ───────────────────────────────────────────────────────

export default function AutomationBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const editId = searchParams.get('id')

  const [workflowName, setWorkflowName] = useState('Untitled Workflow')
  const [editingName, setEditingName] = useState(false)
  const [status, setStatus] = useState<'Draft' | 'Active'>('Draft')
  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: uid(), type: 'trigger', config: {}, label: 'Add New Trigger' },
    { id: uid(), type: 'end', config: {}, label: 'End' },
  ])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showTriggerPicker, setShowTriggerPicker] = useState(false)
  const [showActionPicker, setShowActionPicker] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'builder' | 'runs'>('builder')

  const nameInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editId) return
    type LoadedAction = string | { type: string; config?: Record<string, unknown> }
    fetch(`/api/automations`).then(r => r.ok ? r.json() : []).then((data: { id: string; name: string; trigger: string; actions: LoadedAction[]; status: string; config?: Record<string, unknown> }[]) => {
      const auto = data.find((a: { id: string }) => a.id === editId)
      if (!auto) return
      setWorkflowName(auto.name)
      setStatus(auto.status === 'Active' ? 'Active' : 'Draft')

      const rebuilt: WorkflowNode[] = []

      const triggerKey = Object.entries(TRIGGER_TO_DB).find(([, v]) => v === auto.trigger)?.[0] as TriggerType | undefined
      rebuilt.push({
        id: uid(),
        type: 'trigger',
        subtype: triggerKey,
        // Trigger-level config (deal-stage filter, invoice-overdue-days
        // threshold) previously always reset to {} here even though
        // automations.config is a real, already-persisted column — the
        // builder's own save path just never sent it (see handleSave).
        config: auto.config ?? {},
        label: auto.trigger,
      })

      for (const rawAction of auto.actions) {
        // Tolerates a legacy bare-string action (no config existed before
        // AUDIT.md #12) alongside the new {type, config} shape.
        const actionLabel = typeof rawAction === 'string' ? rawAction : rawAction.type
        const actionConfig = typeof rawAction === 'string' ? {} : (rawAction.config ?? {})
        const actionKey = Object.entries(ACTION_TO_DB).find(([, v]) => v === actionLabel)?.[0] as ActionType | undefined
        rebuilt.push({
          id: uid(),
          type: 'action',
          subtype: actionKey,
          config: actionConfig,
          label: actionLabel,
        })
      }

      rebuilt.push({ id: uid(), type: 'end', config: {}, label: 'End' })
      setNodes(rebuilt)
    }).catch(() => {})
  }, [editId])

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null

  const handleSelectTrigger = useCallback((t: TriggerType) => {
    const meta = getTriggerMeta(t)
    setNodes(prev => prev.map(n => n.type === 'trigger' ? { ...n, subtype: t, label: meta?.label ?? t, config: {} } : n))
    setShowTriggerPicker(false)
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (triggerNode) setSelectedNodeId(triggerNode.id)
  }, [nodes])

  const handleAddAction = useCallback((insertIndex: number, actionType: ActionType) => {
    const meta = getActionMeta(actionType)
    const newNode: WorkflowNode = {
      id: uid(),
      type: 'action',
      subtype: actionType,
      config: {},
      label: meta?.label ?? actionType,
    }
    setNodes(prev => {
      const next = [...prev]
      next.splice(insertIndex, 0, newNode)
      return next
    })
    setShowActionPicker(null)
    setSelectedNodeId(newNode.id)
  }, [])

  const handleDeleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id))
    if (selectedNodeId === id) setSelectedNodeId(null)
  }, [selectedNodeId])

  const handleDuplicateNode = useCallback((id: string) => {
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === id)
      if (idx < 0) return prev
      const source = prev[idx]
      const copy: WorkflowNode = { ...source, id: uid(), config: { ...source.config } }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const handleUpdateConfig = useCallback((config: Record<string, unknown>) => {
    if (!selectedNodeId) return
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, config } : n))
  }, [selectedNodeId])

  const handleSave = useCallback(async () => {
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode?.subtype) {
      toast('Please add a trigger before saving', 'error')
      return
    }
    const actionNodes = nodes.filter(n => n.type === 'action')

    const triggerLabel = TRIGGER_TO_DB[triggerNode.subtype as TriggerType] ?? triggerNode.label
    // Per-action config (AUDIT.md #12) — each action now carries its own
    // {type, config}, not just a bare label string. The engine translates
    // config's field names into what it actually reads; see
    // lib/automations-engine.ts's ACTION_CONFIG_ADAPTERS.
    const actions = actionNodes.map(n => ({
      type: ACTION_TO_DB[n.subtype as ActionType] ?? n.label,
      config: n.config,
    }))

    setSaving(true)
    try {
      // Trigger-level config (deal-stage filter, invoice-overdue-days
      // threshold) was collected in the UI but never sent — automations.config
      // is a real, already-used column (the form_submitted trigger's
      // formScope/formId already round-trip through it), so this was purely
      // a save-path gap, not a schema gap.
      const triggerConfig = triggerNode.config ?? {}

      if (editId) {
        const res = await fetch(`/api/automations/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: workflowName,
            trigger: triggerLabel,
            config: triggerConfig,
            actions,
            status: status === 'Active' ? 'Active' : 'Paused',
          }),
        })
        if (!res.ok) throw new Error('Failed to update')
        toast('Workflow updated', 'success')
      } else {
        const res = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `auto-${Date.now()}`,
            name: workflowName,
            trigger: triggerLabel,
            config: triggerConfig,
            actions,
            status: status === 'Active' ? 'Active' : 'Paused',
            runs: 0,
            lastRun: 'Never',
          }),
        })
        if (!res.ok) throw new Error('Failed to save')
        toast('Workflow saved', 'success')
        router.push('/automation')
      }
    } catch {
      toast('Failed to save workflow', 'error')
    } finally {
      setSaving(false)
    }
  }, [nodes, workflowName, status, editId, toast, router])

  const handleTriggerNodeClick = useCallback(() => {
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode?.subtype) {
      setShowTriggerPicker(true)
    } else {
      setSelectedNodeId(triggerNode.id)
    }
  }, [nodes])

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f8f9fb' }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 flex flex-wrap items-center justify-between px-3 md:px-4 py-2 gap-2 flex-shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <button
            onClick={() => router.push('/automation')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="w-px h-6 bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Zap size={18} className="flex-shrink-0" style={{ color: '#015035' }} />
            {editingName ? (
              <input
                ref={nameInputRef}
                value={workflowName}
                onChange={e => setWorkflowName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
                className="text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-0 w-full max-w-[200px] sm:max-w-none"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-semibold text-gray-900 hover:text-gray-600 flex items-center gap-1.5 truncate min-w-0"
              >
                <span className="truncate">{workflowName}</span>
                <Edit3 size={12} className="text-gray-400 flex-shrink-0" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editId && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${activeTab === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Builder
              </button>
              <button
                onClick={() => setActiveTab('runs')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${activeTab === 'runs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Runs
              </button>
            </div>
          )}
          <button
            onClick={() => setStatus(s => s === 'Draft' ? 'Active' : 'Draft')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
            style={{
              borderColor: status === 'Active' ? '#015035' : '#d1d5db',
              color: status === 'Active' ? '#015035' : '#6b7280',
              background: status === 'Active' ? '#01503508' : '#fff',
            }}
          >
            {status === 'Active' ? <Play size={12} /> : <Pause size={12} />}
            {status}
            <ChevronDown size={12} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            <Save size={14} />
            <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {activeTab === 'runs' && editId ? (
        <RunsTab automationId={editId} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left Sidebar ─────────────────────────────────────────────── */}
          <div className="hidden md:flex w-52 bg-white border-r border-gray-200 p-4 flex-col gap-4 flex-shrink-0">
            <Minimap nodes={nodes} zoom={zoom} />
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Zoom</p>
              <div className="flex items-center justify-between gap-1">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ZoomOut size={14} className="text-gray-500" />
                </button>
                <span className="text-xs font-semibold text-gray-600">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ZoomIn size={14} className="text-gray-500" />
                </button>
                <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <Maximize2 size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nodes</p>
              <p className="text-lg font-bold text-gray-900">{nodes.filter(n => n.type !== 'end').length}</p>
              <p className="text-[10px] text-gray-400">{nodes.filter(n => n.type === 'action').length} actions</p>
            </div>
          </div>

          {/* ── Canvas ───────────────────────────────────────────────────── */}
          <div ref={canvasRef} className="flex-1 overflow-auto min-w-0">
            <div
              className="flex flex-col items-center py-12 px-4 min-h-full"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              {nodes.map((node, idx) => {
                const isLast = idx === nodes.length - 1
                const isFirst = idx === 0
                return (
                  <div key={node.id} className="flex flex-col items-center">
                    {!isFirst && <StaticConnector />}
                    <WorkflowNodeCard
                      node={node}
                      isSelected={selectedNodeId === node.id}
                      onSelect={() => {
                        if (node.type === 'trigger' && !node.subtype) {
                          handleTriggerNodeClick()
                        } else if (node.type !== 'end') {
                          setSelectedNodeId(node.id)
                        }
                      }}
                      onDelete={node.type === 'action' ? () => handleDeleteNode(node.id) : undefined}
                      onDuplicate={node.type === 'action' ? () => handleDuplicateNode(node.id) : undefined}
                    />
                    {!isLast && node.type !== 'end' && (
                      <Connector onAdd={() => setShowActionPicker(idx + 1)} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Right Config Panel ───────────────────────────────────────── */}
          {selectedNode && selectedNode.type !== 'end' && selectedNode.subtype && (
            <>
              <div className="md:hidden fixed inset-0 bg-black/30 z-20" onClick={() => setSelectedNodeId(null)} />
              <NodeConfigPanel
                node={selectedNode}
                onChange={handleUpdateConfig}
                onClose={() => setSelectedNodeId(null)}
              />
            </>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showTriggerPicker && (
        <TriggerPickerModal
          onSelect={handleSelectTrigger}
          onClose={() => setShowTriggerPicker(false)}
        />
      )}

      {showActionPicker !== null && (
        <ActionPickerModal
          onSelect={(actionType) => handleAddAction(showActionPicker, actionType)}
          onClose={() => setShowActionPicker(null)}
        />
      )}

      {/* ── Global Styles ───────────────────────────────────────────────── */}
      <style jsx global>{`
        .cfg-input {
          width: 100%;
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          background: #fff;
        }
        .cfg-input:focus {
          border-color: #015035;
          box-shadow: 0 0 0 2px rgba(1, 80, 53, 0.1);
        }
        select.cfg-input {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2rem;
        }
      `}</style>
    </div>
  )
}
