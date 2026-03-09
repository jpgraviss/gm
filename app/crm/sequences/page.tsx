'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { deals, crmContacts } from '@/lib/data'
import { serviceTypeColors } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import CRMSubNav from '@/components/crm/CRMSubNav'
import {
  X, Mail, Plus, Play, Pause, CheckCircle, Clock, Users, Zap,
  ChevronRight, Edit2, Copy, TrendingUp,
  Eye, MousePointerClick,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SequenceStatus = 'Active' | 'Paused' | 'Draft' | 'Completed'
type StepType = 'email' | 'wait' | 'task' | 'condition'

interface SequenceStep {
  id: string
  type: StepType
  day: number
  subject?: string
  body?: string
  taskTitle?: string
  waitDays?: number
  condition?: string
}

interface EmailSequence {
  id: string
  name: string
  status: SequenceStatus
  trigger: string
  targetSegment: string
  enrolledCount: number
  activeCount: number
  completedCount: number
  openRate: number
  clickRate: number
  replyRate: number
  steps: SequenceStep[]
  createdDate: string
  lastModified: string
}

// ─── Initial Data ──────────────────────────────────────────────────────────────

const INITIAL_SEQUENCES: EmailSequence[] = [
  {
    id: 'seq1',
    name: 'New Lead Nurture — Website',
    status: 'Active',
    trigger: 'Contact tagged as "New Lead" + Service = Website',
    targetSegment: 'Website prospects',
    enrolledCount: 12,
    activeCount: 8,
    completedCount: 4,
    openRate: 62,
    clickRate: 28,
    replyRate: 15,
    createdDate: '2026-01-10',
    lastModified: '2026-02-15',
    steps: [
      { id: 's1', type: 'email', day: 0, subject: 'Your competitors are winning with better websites', body: "Hi {{first_name}},\n\nI noticed you've been exploring website options for {{company}}. We've helped companies in {{industry}} increase leads by 40-60% with a redesigned site.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n{{sender_name}}" },
      { id: 's2', type: 'wait', day: 2, waitDays: 2 },
      { id: 's3', type: 'email', day: 2, subject: 'Case study: How {{similar_company}} got 3x more leads', body: "Following up on my last email — wanted to share a quick case study from a company similar to yours.\n\nIn 90 days we helped them:\n• Redesign their site with modern UX\n• Improve mobile conversion by 55%\n• Rank on page 1 for 12 target keywords\n\nWorth a conversation?" },
      { id: 's4', type: 'wait', day: 5, waitDays: 3 },
      { id: 's5', type: 'task', day: 5, taskTitle: 'Call prospect — check if they received emails' },
      { id: 's6', type: 'email', day: 7, subject: 'Last chance — free website audit for {{company}}', body: "This is my last reach out for now. I'd love to offer you a free website audit — no strings attached.\n\nJust reply \"audit\" and I'll send you a custom report within 24 hours." },
      { id: 's7', type: 'condition', day: 7, condition: "If replied → remove from sequence · If no reply → move to \"Cold\" tag" },
    ],
  },
  {
    id: 'seq2',
    name: 'Proposal Follow-Up',
    status: 'Active',
    trigger: 'Proposal status = Sent (no response after 2 days)',
    targetSegment: 'Prospects with sent proposals',
    enrolledCount: 6,
    activeCount: 5,
    completedCount: 1,
    openRate: 78,
    clickRate: 45,
    replyRate: 33,
    createdDate: '2026-01-20',
    lastModified: '2026-02-20',
    steps: [
      { id: 's8', type: 'email', day: 0, subject: 'Your proposal is ready — a few things to highlight', body: "Hi {{first_name}},\n\nJust wanted to check in on the proposal I sent over. A few things I want to make sure stand out:\n\n1. We included a 30-day quick-start timeline\n2. Payment is flexible — we can split it up\n3. You're locked in at this rate through March\n\nHappy to jump on a call if you have questions." },
      { id: 's9', type: 'wait', day: 3, waitDays: 3 },
      { id: 's10', type: 'email', day: 3, subject: 'Did the proposal make sense?', body: "Quick check-in — did the proposal scope and pricing make sense for what you're trying to accomplish?\n\nIf anything feels off, I'm happy to adjust." },
      { id: 's11', type: 'task', day: 5, taskTitle: 'Call to discuss proposal — mention deadline' },
      { id: 's12', type: 'email', day: 6, subject: '{{company}} — final note on proposal', body: "I don't want to keep filling your inbox, so this'll be my last note on this.\n\nIf the timing isn't right, no worries at all. If you'd like to move forward, just reply and we'll get started right away.\n\nEither way, best of luck!" },
    ],
  },
  {
    id: 'seq3',
    name: 'Renewal Reminder — 90 Days Out',
    status: 'Active',
    trigger: 'Contract renewal date within 90 days',
    targetSegment: 'Active clients nearing renewal',
    enrolledCount: 3,
    activeCount: 3,
    completedCount: 0,
    openRate: 91,
    clickRate: 52,
    replyRate: 44,
    createdDate: '2026-02-01',
    lastModified: '2026-02-22',
    steps: [
      { id: 's13', type: 'email', day: 0, subject: 'Your {{service_type}} contract — renewal coming up', body: "Hi {{first_name}},\n\nYour contract with us renews in about 90 days. I wanted to reach out early to give you plenty of time to review.\n\nLet's schedule a 30-minute review call to walk through results and discuss what's next. Would next week work?" },
      { id: 's14', type: 'wait', day: 14, waitDays: 14 },
      { id: 's15', type: 'email', day: 14, subject: 'Results snapshot — {{company}}', body: "Attached is a quick summary of what we've accomplished together over the last year. Key highlights:\n\n• [Metric 1]\n• [Metric 2]\n• [Metric 3]\n\nI'm excited to share what's planned for the next contract period." },
      { id: 's16', type: 'task', day: 30, taskTitle: 'Send renewal proposal — 60 days before expiration' },
      { id: 's17', type: 'wait', day: 60, waitDays: 30 },
      { id: 's18', type: 'email', day: 60, subject: 'Contract renewal — 30 days remaining', body: "Just a reminder that your contract expires in 30 days. Have you had a chance to look at the renewal proposal?\n\nI'd love to make this a smooth process for you." },
    ],
  },
  {
    id: 'seq4',
    name: 'Re-Engagement — Past Clients',
    status: 'Paused',
    trigger: 'Company status = Past Client · Inactive 6+ months',
    targetSegment: 'Churned or past clients',
    enrolledCount: 5,
    activeCount: 0,
    completedCount: 3,
    openRate: 41,
    clickRate: 12,
    replyRate: 8,
    createdDate: '2025-10-01',
    lastModified: '2026-01-05',
    steps: [
      { id: 's19', type: 'email', day: 0, subject: "It's been a while, {{first_name}}", body: "Hope things are going well at {{company}}! It's been a while since we worked together and I wanted to check in.\n\nWe've launched several new services since then and I thought of you." },
      { id: 's20', type: 'wait', day: 5, waitDays: 5 },
      { id: 's21', type: 'email', day: 5, subject: "What's new at Graviss Marketing", body: "Quick update on what we've been building:\n\n• New AI-powered SEO tooling\n• Redesigned email automation capabilities\n• Expanded social media management\n\nWould any of these be relevant for where {{company}} is headed?" },
    ],
  },
  {
    id: 'seq5',
    name: 'Post-Launch Upsell',
    status: 'Draft',
    trigger: 'Project status = Launched',
    targetSegment: 'Recently launched website clients',
    enrolledCount: 0,
    activeCount: 0,
    completedCount: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    createdDate: '2026-02-20',
    lastModified: '2026-02-20',
    steps: [
      { id: 's22', type: 'email', day: 7, subject: "Congrats on the launch! What's next for {{company}}?", body: "Your site is live and looking great! Now is the perfect time to start driving traffic to it.\n\nWould you be interested in exploring SEO or paid advertising to amplify your launch?" },
      { id: 's23', type: 'wait', day: 14, waitDays: 7 },
      { id: 's24', type: 'email', day: 14, subject: 'Your website is live — are you getting leads?', body: "It's been two weeks since launch. Are you starting to see leads come through the new site?\n\nI'd love to share some quick-win strategies to boost conversions in the first 90 days." },
    ],
  },
]

const statusColors: Record<SequenceStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Paused: 'bg-gray-100 text-gray-500',
  Draft: 'bg-yellow-100 text-yellow-700',
  Completed: 'bg-blue-100 text-blue-700',
}

const stepTypeConfig: Record<StepType, { color: string; label: string; icon: React.ReactNode }> = {
  email:     { color: '#3b82f6', label: 'Email', icon: <Mail size={13} /> },
  wait:      { color: '#9ca3af', label: 'Wait', icon: <Clock size={13} /> },
  task:      { color: '#10b981', label: 'Task', icon: <CheckCircle size={13} /> },
  condition: { color: '#f59e0b', label: 'Branch', icon: <Zap size={13} /> },
}

// ─── Sequence Detail Panel ────────────────────────────────────────────────────

function SequencePanel({
  seq,
  onClose,
  onUpdate,
}: {
  seq: EmailSequence
  onClose: () => void
  onUpdate: (updated: EmailSequence) => void
}) {
  const [tab, setTab] = useState<'steps' | 'stats' | 'enrolled'>('steps')
  const [localSteps, setLocalSteps] = useState<SequenceStep[]>(seq.steps)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editTask, setEditTask] = useState('')
  const [editWaitDays, setEditWaitDays] = useState('')

  // Add Step form
  const [addingStep, setAddingStep] = useState(false)
  const [newStepType, setNewStepType] = useState<StepType>('email')
  const [newStepDay, setNewStepDay] = useState('')
  const [newStepSubject, setNewStepSubject] = useState('')
  const [newStepBody, setNewStepBody] = useState('')
  const [newStepWait, setNewStepWait] = useState('1')
  const [newStepTask, setNewStepTask] = useState('')

  // Enroll contacts
  const [enrolling, setEnrolling] = useState(false)
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollSelections, setEnrollSelections] = useState<Set<string>>(new Set())

  const enrolledContacts = crmContacts.slice(0, seq.enrolledCount)

  function startEdit(step: SequenceStep) {
    setEditingStepId(step.id)
    setEditSubject(step.subject ?? '')
    setEditBody(step.body ?? '')
    setEditTask(step.taskTitle ?? '')
    setEditWaitDays(String(step.waitDays ?? 1))
  }

  function saveEdit(stepId: string) {
    const updated = localSteps.map(s => {
      if (s.id !== stepId) return s
      return {
        ...s,
        subject: s.type === 'email' ? editSubject : s.subject,
        body: s.type === 'email' ? editBody : s.body,
        taskTitle: s.type === 'task' ? editTask : s.taskTitle,
        waitDays: s.type === 'wait' ? Number(editWaitDays) : s.waitDays,
      }
    })
    setLocalSteps(updated)
    onUpdate({ ...seq, steps: updated })
    setEditingStepId(null)
  }

  function addStep() {
    if (!newStepDay) return
    const day = Number(newStepDay)
    const id = `step-${Date.now()}`
    let newStep: SequenceStep
    if (newStepType === 'email') {
      newStep = { id, type: 'email', day, subject: newStepSubject, body: newStepBody }
    } else if (newStepType === 'wait') {
      newStep = { id, type: 'wait', day, waitDays: Number(newStepWait) }
    } else if (newStepType === 'task') {
      newStep = { id, type: 'task', day, taskTitle: newStepTask }
    } else {
      newStep = { id, type: 'condition', day, condition: newStepBody }
    }
    const updated = [...localSteps, newStep].sort((a, b) => a.day - b.day)
    setLocalSteps(updated)
    onUpdate({ ...seq, steps: updated })
    setAddingStep(false)
    setNewStepType('email')
    setNewStepDay('')
    setNewStepSubject('')
    setNewStepBody('')
    setNewStepWait('1')
    setNewStepTask('')
  }

  function commitEnroll() {
    const count = enrollSelections.size
    if (count === 0) { setEnrolling(false); return }
    onUpdate({
      ...seq,
      enrolledCount: seq.enrolledCount + count,
      activeCount: seq.activeCount + count,
    })
    setEnrolling(false)
    setEnrollSelections(new Set())
    setEnrollSearch('')
  }

  const filteredForEnroll = crmContacts.filter(c =>
    !enrolledContacts.some(e => e.id === c.id) &&
    (c.fullName.toLowerCase().includes(enrollSearch.toLowerCase()) ||
      c.companyName.toLowerCase().includes(enrollSearch.toLowerCase()))
  )

  return (
    <>
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(580px, 100vw)' }}>

        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[seq.status]}`}>
                  {seq.status}
                </span>
              </div>
              <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                {seq.name}
              </h2>
              <p className="text-white/50 text-xs mt-1">{seq.trigger}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
              <X size={18} className="text-white/60" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Enrolled', value: seq.enrolledCount.toString() },
              { label: 'Active', value: seq.activeCount.toString() },
              { label: 'Completed', value: seq.completedCount.toString() },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{s.value}</p>
                <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Performance bar */}
        {seq.enrolledCount > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-6">
            {[
              { label: 'Open Rate', value: seq.openRate, icon: <Eye size={13} />, color: '#3b82f6' },
              { label: 'Click Rate', value: seq.clickRate, icon: <MousePointerClick size={13} />, color: '#8b5cf6' },
              { label: 'Reply Rate', value: seq.replyRate, icon: <Mail size={13} />, color: '#015035' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2 flex-1">
                <span style={{ color: m.color }}>{m.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-gray-500">{m.label}</span>
                    <span className="font-semibold text-gray-800">{m.value}%</span>
                  </div>
                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
          {(['steps', 'stats', 'enrolled'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn capitalize flex-shrink-0 ${tab === t ? 'active' : ''}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Steps ── */}
          {tab === 'steps' && (
            <div className="flex flex-col gap-2">
              {localSteps.map((step, i) => {
                const cfg = stepTypeConfig[step.type]
                const isLast = i === localSteps.length - 1
                const isEditing = editingStepId === step.id
                return (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${cfg.color}18`, color: cfg.color }}
                      >
                        {cfg.icon}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" style={{ minHeight: '16px' }} />}
                    </div>
                    <div className={`flex-1 ${isLast ? '' : 'pb-3'}`}>
                      {isEditing ? (
                        <div className={`p-3 rounded-xl border-2 ${
                          step.type === 'email' ? 'border-blue-200 bg-blue-50' :
                          step.type === 'wait' ? 'border-gray-200 bg-gray-50' :
                          step.type === 'task' ? 'border-emerald-200 bg-emerald-50' :
                          'border-yellow-200 bg-yellow-50'
                        }`}>
                          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: cfg.color }}>{cfg.label} · Day {step.day}</p>
                          {step.type === 'email' && (
                            <>
                              <input
                                value={editSubject}
                                onChange={e => setEditSubject(e.target.value)}
                                placeholder="Subject line"
                                className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white outline-none mb-2"
                              />
                              <textarea
                                value={editBody}
                                onChange={e => setEditBody(e.target.value)}
                                placeholder="Email body"
                                rows={5}
                                className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white outline-none resize-none leading-relaxed"
                              />
                            </>
                          )}
                          {step.type === 'task' && (
                            <input
                              value={editTask}
                              onChange={e => setEditTask(e.target.value)}
                              placeholder="Task title"
                              className="w-full text-sm border border-emerald-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                            />
                          )}
                          {step.type === 'wait' && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={editWaitDays}
                                onChange={e => setEditWaitDays(e.target.value)}
                                className="w-20 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                              />
                              <span className="text-sm text-gray-500">days</span>
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEdit(step.id)}
                              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                              style={{ background: '#015035' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStepId(null)}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-3 rounded-xl border ${
                          step.type === 'email' ? 'border-blue-100 bg-blue-50/40' :
                          step.type === 'wait' ? 'border-gray-100 bg-gray-50' :
                          step.type === 'task' ? 'border-emerald-100 bg-emerald-50/40' :
                          'border-yellow-100 bg-yellow-50/40'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                style={{ background: `${cfg.color}18`, color: cfg.color }}
                              >
                                {cfg.label}
                              </span>
                              <span className="text-[11px] text-gray-400">Day {step.day}</span>
                            </div>
                            {step.type !== 'condition' && (
                              <button
                                onClick={() => startEdit(step)}
                                className="p-1 rounded hover:bg-white/70 text-gray-400"
                              >
                                <Edit2 size={11} />
                              </button>
                            )}
                          </div>

                          {step.type === 'email' && (
                            <div>
                              <p className="text-sm font-semibold text-gray-900 mb-1">{step.subject}</p>
                              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{step.body}</p>
                            </div>
                          )}
                          {step.type === 'wait' && (
                            <p className="text-sm text-gray-600">Wait {step.waitDays} day{step.waitDays !== 1 ? 's' : ''} before next step</p>
                          )}
                          {step.type === 'task' && (
                            <p className="text-sm text-gray-800">{step.taskTitle}</p>
                          )}
                          {step.type === 'condition' && (
                            <p className="text-xs text-gray-600 leading-relaxed">{step.condition}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add Step form */}
              {addingStep ? (
                <div className="mt-2 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Step</p>
                    <button onClick={() => setAddingStep(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
                      <select
                        value={newStepType}
                        onChange={e => setNewStepType(e.target.value as StepType)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                      >
                        <option value="email">Email</option>
                        <option value="wait">Wait</option>
                        <option value="task">Task</option>
                        <option value="condition">Branch/Condition</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {newStepType === 'wait' ? 'Wait Days' : 'Send on Day'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newStepType === 'wait' ? newStepWait : newStepDay}
                        onChange={e => newStepType === 'wait' ? setNewStepWait(e.target.value) : setNewStepDay(e.target.value)}
                        placeholder="0"
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                      />
                    </div>
                  </div>
                  {newStepType === 'email' && (
                    <>
                      <input
                        value={newStepSubject}
                        onChange={e => setNewStepSubject(e.target.value)}
                        placeholder="Subject line"
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                      />
                      <textarea
                        value={newStepBody}
                        onChange={e => setNewStepBody(e.target.value)}
                        placeholder="Email body (use {{first_name}}, {{company}} for personalization)"
                        rows={4}
                        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none resize-none leading-relaxed"
                      />
                    </>
                  )}
                  {newStepType === 'task' && (
                    <input
                      value={newStepTask}
                      onChange={e => setNewStepTask(e.target.value)}
                      placeholder="Task title (e.g. Call prospect, Send LinkedIn connection)"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                    />
                  )}
                  {newStepType === 'condition' && (
                    <textarea
                      value={newStepBody}
                      onChange={e => setNewStepBody(e.target.value)}
                      placeholder="Condition logic (e.g. If replied → remove · If no reply → continue)"
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none resize-none"
                    />
                  )}
                  <button
                    onClick={addStep}
                    disabled={!newStepDay && newStepType !== 'wait'}
                    className="py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    Add Step
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingStep(true)}
                  className="mt-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Step
                </button>
              )}
            </div>
          )}

          {/* ── Stats ── */}
          {tab === 'stats' && (
            <div className="flex flex-col gap-4">
              {seq.enrolledCount === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No stats yet — sequence hasn't run</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Open Rate', value: `${seq.openRate}%`, sub: 'Industry avg: 21%', good: seq.openRate > 21 },
                      { label: 'Click Rate', value: `${seq.clickRate}%`, sub: 'Industry avg: 2.6%', good: seq.clickRate > 2.6 },
                      { label: 'Reply Rate', value: `${seq.replyRate}%`, sub: 'Industry avg: 8%', good: seq.replyRate > 8 },
                    ].map(m => (
                      <div key={m.label} className="p-4 bg-gray-50 rounded-xl text-center">
                        <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'var(--font-syncopate), sans-serif', color: m.good ? '#015035' : '#6b7280' }}>
                          {m.value}
                        </p>
                        <p className="text-xs font-semibold text-gray-600">{m.label}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{m.sub}</p>
                        <div className={`mt-1.5 text-[10px] font-semibold ${m.good ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {m.good ? '↑ Above avg' : '↓ Below avg'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Enrollment Funnel</p>
                    {[
                      { label: 'Enrolled', count: seq.enrolledCount, color: '#015035' },
                      { label: 'Opened at least 1 email', count: Math.round(seq.enrolledCount * seq.openRate / 100), color: '#3b82f6' },
                      { label: 'Clicked a link', count: Math.round(seq.enrolledCount * seq.clickRate / 100), color: '#8b5cf6' },
                      { label: 'Replied', count: Math.round(seq.enrolledCount * seq.replyRate / 100), color: '#10b981' },
                    ].map(f => (
                      <div key={f.label} className="mb-3 last:mb-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{f.label}</span>
                          <span className="font-semibold text-gray-900">{f.count}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(f.count / seq.enrolledCount) * 100}%`, background: f.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Enrolled ── */}
          {tab === 'enrolled' && (
            <div className="flex flex-col gap-2">
              {enrolledContacts.map(c => {
                const activeDeal = deals.find(d => d.company === c.companyName && !d.stage.startsWith('Closed'))
                const stepNum = Math.floor(Math.random() * seq.steps.filter(s => s.type === 'email').length) + 1
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{c.fullName}</p>
                      <p className="text-xs text-gray-400">{c.companyName} · {c.title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-600">
                        Step {stepNum} of {seq.steps.filter(s => s.type === 'email').length}
                      </p>
                      {activeDeal && (
                        <p className="text-[11px] text-emerald-600 font-medium">{activeDeal.stage}</p>
                      )}
                    </div>
                  </div>
                )
              })}
              {enrolledContacts.length === 0 && !enrolling && (
                <div className="text-center py-8">
                  <Users size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No contacts enrolled yet</p>
                </div>
              )}

              {/* Enroll form */}
              {enrolling ? (
                <div className="mt-2 p-4 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                      Select contacts to enroll
                    </p>
                    <button onClick={() => { setEnrolling(false); setEnrollSelections(new Set()) }} className="text-blue-400 hover:text-blue-600">
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    value={enrollSearch}
                    onChange={e => setEnrollSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full text-sm border border-blue-200 rounded-lg px-2.5 py-1.5 bg-white outline-none"
                  />
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                    {filteredForEnroll.slice(0, 20).map(c => (
                      <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-blue-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enrollSelections.has(c.id)}
                          onChange={() => {
                            setEnrollSelections(prev => {
                              const next = new Set(prev)
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                              return next
                            })
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{c.fullName}</p>
                          <p className="text-xs text-gray-500">{c.companyName}</p>
                        </div>
                      </label>
                    ))}
                    {filteredForEnroll.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No eligible contacts found</p>
                    )}
                  </div>
                  <button
                    onClick={commitEnroll}
                    disabled={enrollSelections.size === 0}
                    className="py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    Enroll {enrollSelections.size > 0 ? `${enrollSelections.size} Contact${enrollSelections.size > 1 ? 's' : ''}` : 'Contacts'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEnrolling(true)}
                  className="mt-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Enroll Contacts
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0 flex-wrap">
          {seq.status === 'Active' ? (
            <button
              onClick={() => onUpdate({ ...seq, status: 'Paused' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              <Pause size={14} /> Pause
            </button>
          ) : seq.status === 'Paused' || seq.status === 'Draft' ? (
            <button
              onClick={() => onUpdate({ ...seq, status: 'Active' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
              style={{ background: '#015035' }}
            >
              <Play size={14} /> Activate
            </button>
          ) : null}
          <button
            onClick={() => onUpdate({
              ...seq,
              id: `seq-copy-${Date.now()}`,
              name: `${seq.name} (Copy)`,
              status: 'Draft',
              enrolledCount: 0,
              activeCount: 0,
              completedCount: 0,
              openRate: 0,
              clickRate: 0,
              replyRate: 0,
              createdDate: new Date().toISOString().split('T')[0],
              lastModified: new Date().toISOString().split('T')[0],
            })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            <Copy size={14} /> Duplicate
          </button>
          <button onClick={onClose} className="ml-auto px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

// ─── New Sequence Modal ───────────────────────────────────────────────────────

function NewSequenceModal({ onSave, onClose }: { onSave: (s: EmailSequence) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('')
  const [segment, setSegment] = useState('')

  function save() {
    if (!name.trim()) return
    const newSeq: EmailSequence = {
      id: `seq-${Date.now()}`,
      name: name.trim(),
      status: 'Draft',
      trigger: trigger.trim() || 'Manual enrollment',
      targetSegment: segment.trim() || 'All contacts',
      enrolledCount: 0,
      activeCount: 0,
      completedCount: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      steps: [],
      createdDate: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
    }
    onSave(newSeq)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">New Email Sequence</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sequence Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Lead Nurture — SEO"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Trigger / Enrollment Rule</label>
            <input
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              placeholder="e.g. Contact tagged as New Lead + Service = SEO"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Target Segment</label>
            <input
              value={segment}
              onChange={e => setSegment(e.target.value)}
              placeholder="e.g. SEO prospects"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={!name.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              Create Sequence
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const [localSequences, setLocalSequences] = useState<EmailSequence[]>(INITIAL_SEQUENCES)
  const [selectedSeq, setSelectedSeq] = useState<EmailSequence | null>(null)
  const [statusFilter, setStatusFilter] = useState<SequenceStatus | 'All'>('All')
  const [creatingSeq, setCreatingSeq] = useState(false)

  function updateSequence(updated: EmailSequence) {
    // Duplicate creates a new sequence (different id)
    const exists = localSequences.some(s => s.id === updated.id)
    if (exists) {
      setLocalSequences(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelectedSeq(updated)
    } else {
      // New duplicate — add to list and open it
      setLocalSequences(prev => [updated, ...prev])
      setSelectedSeq(updated)
    }
  }

  function addSequence(newSeq: EmailSequence) {
    setLocalSequences(prev => [newSeq, ...prev])
    setCreatingSeq(false)
    setSelectedSeq(newSeq)
  }

  const filtered = statusFilter === 'All' ? localSequences : localSequences.filter(s => s.status === statusFilter)

  return (
    <>
      <Header
        title="CRM & Pipeline"
        subtitle="Companies · Contacts · Deals · Activity"
        action={{ label: 'New Sequence', onClick: () => setCreatingSeq(true) }}
      />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <CRMSubNav />

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 overflow-x-auto pb-0.5 flex-1 min-w-0">
            {(['All', 'Active', 'Paused', 'Draft', 'Completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`tab-btn flex-shrink-0 ${statusFilter === s ? 'active' : ''}`}
              >
                {s}
                {s !== 'All' && (
                  <span className="ml-1 opacity-60">({localSequences.filter(q => q.status === s).length})</span>
                )}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500 flex-shrink-0">{filtered.length} sequences</span>
        </div>

        {/* Sequence Cards */}
        <div className="flex flex-col gap-3">
          {filtered.map(seq => (
            <div
              key={seq.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setSelectedSeq(seq)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: seq.status === 'Active' ? '#e6f0ec' :
                        seq.status === 'Paused' ? '#f5f5f5' :
                        seq.status === 'Draft' ? '#fefce8' : '#eff6ff'
                    }}
                  >
                    <Mail
                      size={16}
                      style={{
                        color: seq.status === 'Active' ? '#015035' :
                          seq.status === 'Paused' ? '#9ca3af' :
                          seq.status === 'Draft' ? '#f59e0b' : '#3b82f6'
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{seq.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColors[seq.status]}`}>
                        {seq.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">{seq.trigger}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Mail size={10} />
                        {seq.steps.filter(s => s.type === 'email').length} emails
                      </span>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock size={10} />
                        {seq.steps.reduce((s, st) => s + (st.waitDays ?? 0), 0)} days
                      </span>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Users size={10} />
                        {seq.enrolledCount} enrolled
                      </span>
                      {seq.enrolledCount > 0 && (
                        <>
                          <span className="text-[11px] text-blue-600 flex items-center gap-1">
                            <Eye size={10} /> {seq.openRate}% open
                          </span>
                          <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                            <Mail size={10} /> {seq.replyRate}% reply
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    onClick={e => {
                      e.stopPropagation()
                      const updated = {
                        ...seq,
                        status: (seq.status === 'Active' ? 'Paused' : 'Active') as SequenceStatus,
                      }
                      setLocalSequences(prev => prev.map(s => s.id === seq.id ? updated : s))
                    }}
                    title={seq.status === 'Active' ? 'Pause' : 'Activate'}
                  >
                    {seq.status === 'Active'
                      ? <Pause size={14} className="text-gray-400" />
                      : <Play size={14} className="text-gray-400" />
                    }
                  </button>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Mail size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No sequences found</p>
            <button
              onClick={() => setCreatingSeq(true)}
              className="mt-3 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ background: '#015035' }}
            >
              Create your first sequence
            </button>
          </div>
        )}
      </div>

      {selectedSeq && (
        <SequencePanel
          seq={localSequences.find(s => s.id === selectedSeq.id) ?? selectedSeq}
          onClose={() => setSelectedSeq(null)}
          onUpdate={updateSequence}
        />
      )}
      {creatingSeq && <NewSequenceModal onSave={addSequence} onClose={() => setCreatingSeq(false)} />}
    </>
  )
}
