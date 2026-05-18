'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import CompanySelect from '@/components/ui/CompanySelect'
import { useToast } from '@/components/ui/Toast'
import {
  Search, ChevronDown, ChevronUp, CheckCircle2, Circle, Clock,
  Plus, X, Send, Package, Filter, ArrowUpDown, UserPlus, Calendar,
} from 'lucide-react'
import NewClientModal from '@/components/admin/NewClientModal'

const SERVICE_TYPES = [
  'SEO', 'PPC', 'Web Design', 'Social Media',
  'Email Marketing', 'Content Creation', 'Sales Training', 'Marketing Strategy',
] as const

const STEP_NAMES = [
  'Contract Signed',
  'Invoice & Payment',
  'Welcome Email',
  'Portal Access',
  'Strategy Call',
  'Usage Guide & Resources',
  'Deliverables',
  'Reporting & Analytics',
]

const FILTER_TABS = ['All', 'Onboarding', 'Active', 'Delivery', 'Completed'] as const
type FilterTab = typeof FILTER_TABS[number]

interface WorkflowStep {
  step: number
  name: string
  status: 'completed' | 'in_progress' | 'pending'
  completedDate?: string
}

interface Workflow {
  id: string
  company: string
  service: string
  projectId?: string
  currentStep: number
  steps: WorkflowStep[]
  startedDate: string
  lastUpdated: string
}

interface Project {
  id: string
  name: string
}

function getStepPhase(step: number): 'onboarding' | 'active' | 'delivery' {
  if (step <= 3) return 'onboarding'
  if (step <= 6) return 'active'
  return 'delivery'
}

function isWorkflowCompleted(w: Workflow): boolean {
  return w.steps.every(s => s.status === 'completed')
}

function getWorkflowCategory(w: Workflow): FilterTab {
  if (isWorkflowCompleted(w)) return 'Completed'
  const phase = getStepPhase(w.currentStep)
  if (phase === 'onboarding') return 'Onboarding'
  if (phase === 'active') return 'Active'
  return 'Delivery'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ProgressBar({ steps }: { steps: WorkflowStep[] }) {
  const completed = steps.filter(s => s.status === 'completed').length
  const pct = Math.round((completed / steps.length) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#015035' }} />
      </div>
      <span className="text-[11px] text-gray-500 font-medium">{pct}%</span>
    </div>
  )
}

function WorkflowTimeline({
  workflow,
  onMarkComplete,
  onSendTemplate,
  onAddDeliverable,
}: {
  workflow: Workflow
  onMarkComplete: (workflowId: string, step: number) => void
  onSendTemplate: (workflowId: string, step: number) => void
  onAddDeliverable: (workflowId: string) => void
}) {
  return (
    <div className="px-4 sm:px-6 pb-5 pt-2">
      <div className="grid gap-2">
        {workflow.steps.map((step) => {
          const isCompleted = step.status === 'completed'
          const isInProgress = step.status === 'in_progress'
          const showSendTemplate = [3, 6, 8].includes(step.step)
          const showAddDeliverable = step.step === 7

          return (
            <div key={step.step} className={`flex items-center gap-3 p-3 rounded-xl border ${isCompleted ? 'bg-[#015035]/[0.02] border-[#015035]/10' : isInProgress ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 size={18} className="text-[#015035]" />
                ) : isInProgress ? (
                  <div className="relative">
                    <Clock size={18} className="text-amber-500" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  </div>
                ) : (
                  <Circle size={18} className="text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${isCompleted ? 'text-gray-700' : isInProgress ? 'text-gray-900' : 'text-gray-400'}`}>
                  <span className="text-gray-400 mr-1">{String(step.step).padStart(2, '0')}</span>
                  {step.name}
                </p>
                {isCompleted && step.completedDate && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatShortDate(step.completedDate)}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!isCompleted && (
                  <button
                    onClick={() => onMarkComplete(workflow.id, step.step)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                  >
                    Mark Complete
                  </button>
                )}
                {showSendTemplate && (
                  <button
                    onClick={() => onSendTemplate(workflow.id, step.step)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white whitespace-nowrap flex items-center gap-1"
                    style={{ background: '#015035' }}
                  >
                    <Send size={10} /> Template
                  </button>
                )}
                {showAddDeliverable && (
                  <button
                    onClick={() => onAddDeliverable(workflow.id)}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg border text-[#015035] border-[#015035]/30 hover:bg-[#015035]/5 whitespace-nowrap flex items-center gap-1"
                  >
                    <Plus size={10} /> Deliverable
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NewWorkflowModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { company: string; service: string; projectId?: string }) => void
}) {
  const [company, setCompany] = useState('')
  const [service, setService] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => { if (!cancelled && Array.isArray(data)) setProjects(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  }, [])

  const canCreate = company.trim() && service

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>New Delivery Workflow</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Company</label>
            <CompanySelect value={company} onChange={(name) => setCompany(name)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Service Type</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select service...</option>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loadingProjects}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
            >
              <option value="">{loadingProjects ? 'Loading...' : 'Select project...'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => { if (canCreate) onCreate({ company, service, projectId: projectId || undefined }) }}
            disabled={!canCreate}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            Create Workflow
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DeliveryDashboardPage() {
  const { toast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [sortField, setSortField] = useState<'company' | 'lastUpdated'>('lastUpdated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [sendModal, setSendModal] = useState<{ workflowId: string; step: number } | null>(null)
  const [sendModalScheduleDate, setSendModalScheduleDate] = useState('')
  const [sendModalScheduleTime, setSendModalScheduleTime] = useState('08:00')
  const [sendModalRecurring, setSendModalRecurring] = useState('none')
  const [sendModalMode, setSendModalMode] = useState<'now' | 'schedule'>('now')

  useEffect(() => {
    fetch('/api/delivery/workflows')
      .then(r => r.ok ? r.json() : [])
      .then((data: Workflow[]) => { if (Array.isArray(data)) setWorkflows(data) })
      .catch(() => toast('Failed to load workflows', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const kpis = {
    total: workflows.length,
    onboarding: workflows.filter(w => !isWorkflowCompleted(w) && getStepPhase(w.currentStep) === 'onboarding').length,
    active: workflows.filter(w => !isWorkflowCompleted(w) && getStepPhase(w.currentStep) === 'active').length,
    delivery: workflows.filter(w => !isWorkflowCompleted(w) && getStepPhase(w.currentStep) === 'delivery').length,
    completed: workflows.filter(w => isWorkflowCompleted(w)).length,
  }

  const filtered = workflows
    .filter(w => {
      if (activeTab !== 'All' && getWorkflowCategory(w) !== activeTab) return false
      if (searchQuery && !w.company.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortField === 'company') return mul * a.company.localeCompare(b.company)
      return mul * (new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
    })

  function handleMarkComplete(workflowId: string, stepNum: number) {
    setWorkflows(prev => prev.map(w => {
      if (w.id !== workflowId) return w
      const newSteps = w.steps.map(s => {
        if (s.step !== stepNum) return s
        return { ...s, status: 'completed' as const, completedDate: new Date().toISOString().split('T')[0] }
      })
      const nextPending = newSteps.find(s => s.status !== 'completed')
      const updatedSteps = nextPending
        ? newSteps.map(s => s.step === nextPending.step ? { ...s, status: 'in_progress' as const } : s)
        : newSteps
      const newCurrent = nextPending ? nextPending.step : 8
      return { ...w, steps: updatedSteps, currentStep: newCurrent, lastUpdated: new Date().toISOString().split('T')[0] }
    }))
    fetch(`/api/delivery/workflows/${workflowId}/steps/${stepNum}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => toast('Failed to update step', 'error'))
  }

  function handleSendTemplate(workflowId: string, stepNum: number) {
    setSendModal({ workflowId, step: stepNum })
    setSendModalMode('now')
    setSendModalScheduleDate('')
    setSendModalScheduleTime('08:00')
    setSendModalRecurring('none')
  }

  async function executeSendTemplate() {
    if (!sendModal) return
    const payload: Record<string, unknown> = { step: sendModal.step }
    if (sendModalMode === 'schedule' && sendModalScheduleDate) {
      payload.scheduleAt = new Date(`${sendModalScheduleDate}T${sendModalScheduleTime}`).toISOString()
      if (sendModalRecurring !== 'none') payload.recurring = sendModalRecurring
    }
    try {
      const res = await fetch(`/api/delivery/workflows/${sendModal.workflowId}/send-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { toast('Failed to send', 'error'); return }
      toast(sendModalMode === 'schedule' ? 'Email scheduled' : `Template for step ${sendModal.step} sent`, 'success')
    } catch {
      toast('Failed to send template', 'error')
    }
    setSendModal(null)
  }

  function handleAddDeliverable(workflowId: string) {
    toast('Add deliverable from the project panel', 'info')
  }

  function handleCreateWorkflow(data: { company: string; service: string; projectId?: string }) {
    const now = new Date().toISOString().split('T')[0]
    const newWorkflow: Workflow = {
      id: `wf-${Date.now()}`,
      company: data.company,
      service: data.service,
      projectId: data.projectId,
      currentStep: 1,
      steps: STEP_NAMES.map((name, i) => ({
        step: i + 1,
        name,
        status: i === 0 ? 'in_progress' as const : 'pending' as const,
      })),
      startedDate: now,
      lastUpdated: now,
    }
    setWorkflows(prev => [newWorkflow, ...prev])
    setShowNewModal(false)
    fetch('/api/delivery/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => toast('Failed to create workflow', 'error'))
  }

  function toggleSort(field: 'company' | 'lastUpdated') {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  if (loading) {
    return (
      <>
        <Header title="Delivery Dashboard" subtitle="8-Step Client Delivery System" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Delivery Dashboard"
        subtitle="8-Step Client Delivery System"
        action={{ label: 'New Workflow', onClick: () => setShowNewModal(true) }}
      />
      <NewClientModal open={showNewClientModal} onClose={() => setShowNewClientModal(false)} />
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setShowNewClientModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#015035] border border-[#015035]/20 hover:bg-[#015035]/5 transition-colors"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">New Client</span>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Workflows', value: kpis.total, color: '#374151' },
            { label: 'Step 1–3 (Onboarding)', value: kpis.onboarding, color: '#3b82f6' },
            { label: 'Step 4–6 (Active)', value: kpis.active, color: '#f59e0b' },
            { label: 'Step 7–8 (Delivery)', value: kpis.delivery, color: '#8b5cf6' },
            { label: 'Completed', value: kpis.completed, color: '#015035' },
          ].map(k => (
            <div key={k.label} className="metric-card">
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: k.color }}>{k.value}</p>
              <p className="text-[11px] text-gray-500 font-medium mt-1">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-btn flex-shrink-0 ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-0 w-full sm:w-auto sm:max-w-xs">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none flex-1 min-w-0"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex-1">
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_100px_100px_80px] gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <button onClick={() => toggleSort('company')} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left flex items-center gap-1">
              Company <ArrowUpDown size={10} />
            </button>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Service</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Step</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Progress</span>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Started</span>
            <button onClick={() => toggleSort('lastUpdated')} className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left flex items-center gap-1">
              Updated <ArrowUpDown size={10} />
            </button>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Actions</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No workflows found</p>
              <p className="text-xs text-gray-400 mt-1">Create a new workflow to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(w => {
                const isExpanded = expandedId === w.id
                const completed = isWorkflowCompleted(w)
                const currentStepName = w.steps.find(s => s.step === w.currentStep)?.name ?? ''

                return (
                  <div key={w.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : w.id)}
                      className="w-full text-left hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_100px_100px_80px] gap-2 px-5 py-3.5 items-center">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                            {w.company[0]}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 truncate">{w.company}</span>
                        </div>
                        <span className="text-xs text-gray-500">{w.service}</span>
                        <div>
                          {completed ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#015035' }}>Done</span>
                          ) : (
                            <span className="text-xs text-gray-700 font-medium">Step {w.currentStep}</span>
                          )}
                        </div>
                        <ProgressBar steps={w.steps} />
                        <span className="text-xs text-gray-400">{formatShortDate(w.startedDate)}</span>
                        <span className="text-xs text-gray-400">{formatShortDate(w.lastUpdated)}</span>
                        <div className="flex justify-center">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </div>

                      <div className="md:hidden px-4 py-3.5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                            {w.company[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{w.company}</p>
                            <p className="text-xs text-gray-400">{w.service}</p>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {completed ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#015035' }}>Done</span>
                            ) : (
                              <span className="text-xs text-gray-500">Step {w.currentStep}: {currentStepName}</span>
                            )}
                          </div>
                          <ProgressBar steps={w.steps} />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <WorkflowTimeline
                        workflow={w}
                        onMarkComplete={handleMarkComplete}
                        onSendTemplate={handleSendTemplate}
                        onAddDeliverable={handleAddDeliverable}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSendModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Send Template — Step {sendModal.step}</h2>
              <button onClick={() => setSendModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setSendModalMode('now')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                    sendModalMode === 'now' ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={sendModalMode === 'now' ? { background: '#015035' } : undefined}
                >
                  <Send size={14} /> Send Now
                </button>
                <button
                  onClick={() => setSendModalMode('schedule')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors ${
                    sendModalMode === 'schedule' ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={sendModalMode === 'schedule' ? { background: '#1e40af' } : undefined}
                >
                  <Calendar size={14} /> Schedule
                </button>
              </div>
              {sendModalMode === 'schedule' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
                      <input
                        type="date"
                        value={sendModalScheduleDate}
                        onChange={e => setSendModalScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Time</label>
                      <input
                        type="time"
                        value={sendModalScheduleTime}
                        onChange={e => setSendModalScheduleTime(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  {sendModal.step === 8 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Recurring</label>
                      <select
                        value={sendModalRecurring}
                        onChange={e => setSendModalRecurring(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="none">One-time</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={executeSendTemplate}
                disabled={sendModalMode === 'schedule' && !sendModalScheduleDate}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: sendModalMode === 'now' ? '#015035' : '#1e40af' }}
              >
                {sendModalMode === 'now' ? <><Send size={14} /> Send Now</> : <><Calendar size={14} /> Schedule</>}
              </button>
              <button onClick={() => setSendModal(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewWorkflowModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreateWorkflow}
        />
      )}
    </>
  )
}
