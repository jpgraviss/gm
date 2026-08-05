'use client'

import { useState, useEffect } from 'react'
import { useClientCompany } from '@/lib/useClientCompany'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  CheckCircle2, Clock, Circle, ChevronDown, ChevronUp,
  Download, FileText, Mail, ExternalLink, Calendar, BookOpen, BarChart3,
  Package,
} from 'lucide-react'

// Ported from app/portal/workflow/page.tsx as part of the /portal -> /client
// merge (Batch 3). Same data/API call as the portal original; chrome
// (company identity header, notifications, sign-out, cross-route nav) now
// comes from app/client/layout.tsx instead of being reimplemented here, so
// this page only renders its own page-specific header + content.

// AUDIT #693 — every field here is optional and several have no data source
// behind them at all (contract/invoice document URLs, welcome-email permalink,
// strategy-call booking link, usage-guide + help-article URLs, monthly-report
// artifact and metrics). GET /api/delivery/workflow deliberately omits those
// rather than inventing them — see the long comment above mapWorkflow() for
// what each would need. So any step can legitimately arrive with partial
// details or none, and the panel below must read honestly in that case.
interface StepDetail {
  contractUrl?: string
  signatureStatus?: string
  invoiceAmount?: number
  paymentStatus?: string
  invoiceUrl?: string
  welcomeEmailDate?: string
  welcomeEmailUrl?: string
  portalAccess?: string
  firstLoginDate?: string
  bookingLink?: string
  meetingNotes?: string
  usageGuideUrl?: string
  usageGuideSentDate?: string
  helpArticles?: { title: string; url: string }[]
  deliverables?: { name: string; url?: string }[]
  reportUrl?: string
  lastReportSentDate?: string
  metricsPreview?: { label: string; value: string }[]
}

// Which StepDetail fields each step actually renders — used to decide whether
// an expanded step has anything to show, so it never opens to a blank box.
const STEP_DETAIL_FIELDS: Record<number, (keyof StepDetail)[]> = {
  1: ['signatureStatus', 'contractUrl'],
  2: ['invoiceAmount', 'paymentStatus', 'invoiceUrl'],
  3: ['welcomeEmailDate', 'welcomeEmailUrl'],
  4: ['portalAccess', 'firstLoginDate'],
  5: ['bookingLink', 'meetingNotes'],
  6: ['usageGuideUrl', 'usageGuideSentDate', 'helpArticles'],
  7: ['deliverables'],
  8: ['reportUrl', 'lastReportSentDate', 'metricsPreview'],
}

const EMPTY_DETAIL_MESSAGES: Record<number, string> = {
  7: 'No deliverables uploaded yet.',
}

function hasStepDetails(step: number, details?: StepDetail): boolean {
  if (!details) return false
  return (STEP_DETAIL_FIELDS[step] ?? []).some(field => {
    const value = details[field]
    if (value === undefined || value === null) return false
    if (Array.isArray(value)) return value.length > 0
    return true
  })
}

interface WorkflowStep {
  step: number
  name: string
  status: 'completed' | 'in_progress' | 'pending'
  completedDate?: string
  currentAction?: string
  details?: StepDetail
}

interface WorkflowData {
  id: string
  company: string
  service: string
  steps: WorkflowStep[]
}

const STEP_ICONS = [FileText, Package, Mail, ExternalLink, Calendar, BookOpen, Download, BarChart3]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StepCard({ step, expanded, onToggle }: { step: WorkflowStep; expanded: boolean; onToggle: () => void }) {
  const Icon = STEP_ICONS[step.step - 1] ?? Circle
  const isCompleted = step.status === 'completed'
  const isInProgress = step.status === 'in_progress'

  return (
    <div className={`rounded-2xl border transition-all ${isCompleted ? 'border-[#015035]/20 bg-[#015035]/[0.02]' : isInProgress ? 'border-[#015035]/40 bg-white shadow-sm' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 sm:p-5 text-left"
      >
        <div className="relative flex-shrink-0">
          {isCompleted ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#015035' }}>
              <CheckCircle2 size={20} className="text-white" />
            </div>
          ) : isInProgress ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center relative" style={{ background: '#015035' }}>
              <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#015035' }} />
              <span className="text-white text-sm font-bold">{String(step.step).padStart(2, '0')}</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-sm font-bold">{String(step.step).padStart(2, '0')}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${isCompleted ? 'text-gray-900' : isInProgress ? 'text-gray-900' : 'text-gray-400'}`}>
              {step.name}
            </p>
            {isCompleted && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: '#015035' }}>
                Complete
              </span>
            )}
            {isInProgress && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                In Progress
              </span>
            )}
            {step.status === 'pending' && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Coming Soon
              </span>
            )}
          </div>
          {isCompleted && step.completedDate && (
            <p className="text-xs text-gray-400 mt-0.5">Completed {formatDate(step.completedDate)}</p>
          )}
          {isInProgress && step.currentAction && (
            <p className="text-xs text-amber-600 mt-0.5">{step.currentAction}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-gray-400">
          <Icon size={16} className={isCompleted ? 'text-[#015035]' : isInProgress ? 'text-[#015035]' : ''} />
        </div>

        <div className="flex-shrink-0">
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {hasStepDetails(step.step, step.details) ? (
              <StepDetails step={step.step} details={step.details!} />
            ) : (
              <p className="text-sm text-gray-400">
                {EMPTY_DETAIL_MESSAGES[step.step] ?? 'No details available for this step yet.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StepDetails({ step, details }: { step: number; details: StepDetail }) {
  switch (step) {
    case 1:
      return (
        <>
          {details.signatureStatus && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Signature</span>
              <span className={`font-medium ${details.signatureStatus === 'Signed' ? 'text-[#015035]' : 'text-amber-600'}`}>
                {details.signatureStatus}
              </span>
            </div>
          )}
          {details.contractUrl && (
            <a href={details.contractUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Download size={14} /> Download Contract
            </a>
          )}
        </>
      )
    case 2:
      return (
        <>
          {details.invoiceAmount !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-900">${details.invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          {details.paymentStatus && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Payment</span>
              <span className={`font-medium ${details.paymentStatus === 'Paid' ? 'text-[#015035]' : 'text-amber-600'}`}>
                {details.paymentStatus}
              </span>
            </div>
          )}
          {details.invoiceUrl && (
            <a href={details.invoiceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Download size={14} /> Download Invoice
            </a>
          )}
        </>
      )
    case 3:
      return (
        <>
          {details.welcomeEmailDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Sent</span>
              <span className="font-medium text-gray-900">{formatDate(details.welcomeEmailDate)}</span>
            </div>
          )}
          {details.welcomeEmailUrl && (
            <a href={details.welcomeEmailUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Mail size={14} /> Re-read Welcome Email
            </a>
          )}
        </>
      )
    case 4:
      return (
        <>
          {details.portalAccess && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Portal Access</span>
              <span className={`font-medium ${details.portalAccess === 'Active' ? 'text-[#015035]' : 'text-amber-600'}`}>
                {details.portalAccess}
              </span>
            </div>
          )}
          {details.firstLoginDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">First Login</span>
              <span className="font-medium text-gray-900">{formatDate(details.firstLoginDate)}</span>
            </div>
          )}
        </>
      )
    case 5:
      return (
        <>
          {details.bookingLink && (
            <a href={details.bookingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Calendar size={14} /> Book Strategy Call
            </a>
          )}
          {details.meetingNotes && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Meeting Notes</p>
              <p className="text-sm text-gray-700">{details.meetingNotes}</p>
            </div>
          )}
        </>
      )
    case 6:
      return (
        <>
          {details.usageGuideSentDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Sent</span>
              <span className="font-medium text-gray-900">{formatDate(details.usageGuideSentDate)}</span>
            </div>
          )}
          {details.usageGuideUrl && (
            <a href={details.usageGuideUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Download size={14} /> Download Usage Guide
            </a>
          )}
          {details.helpArticles && details.helpArticles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500">Help Articles</p>
              {details.helpArticles.map((article, i) => (
                <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#015035] hover:underline">
                  <BookOpen size={13} /> {article.title}
                </a>
              ))}
            </div>
          )}
        </>
      )
    case 7:
      // A deliverable's file link is optional when staff add it, so list the
      // ones without a link as plain text instead of a dead anchor.
      return (
        <div className="space-y-1.5">
          {(details.deliverables ?? []).map((d, i) => (
            d.url ? (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#015035] hover:underline font-medium">
                <Download size={13} /> {d.name}
              </a>
            ) : (
              <p key={i} className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                <Package size={13} className="text-gray-400" /> {d.name}
              </p>
            )
          ))}
        </div>
      )
    case 8:
      return (
        <>
          {details.lastReportSentDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Latest Report Sent</span>
              <span className="font-medium text-gray-900">{formatDate(details.lastReportSentDate)}</span>
            </div>
          )}
          {details.reportUrl && (
            <a href={details.reportUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: '#015035' }}>
              <Download size={14} /> Download Latest Report
            </a>
          )}
          {details.metricsPreview && details.metricsPreview.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {details.metricsPreview.map((m, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-400">{m.label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )
    default:
      return null
  }
}

export default function ClientWorkflowPage() {
  const { toast } = useToast()
  const { company } = useClientCompany()
  // AUDIT #472 — /api/delivery/workflow?company= can return more than one
  // row for a company with concurrent engagements (multiple services, e.g.
  // a website build alongside an SEO retainer); this used to keep only
  // data[0], so every workflow but the newest was silently invisible to
  // the client with no list/selector and no error — same bug class #399
  // already fixed on the client portal's Project tab. Now keeps the full
  // list and derives the displayed workflow from a selection, defaulting
  // to the first (most recent, per the API's created_at-desc ordering).
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const workflow = workflows.find(w => w.id === selectedWorkflowId) ?? workflows[0] ?? null
  const [loading, setLoading] = useState(true)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  useEffect(() => {
    if (!company) {
      requestAnimationFrame(() => setLoading(false))
      return
    }
    // GET /api/delivery/workflow always returns a JSON array (it's
    // cursor-paginated), even scoped to a single company — treating it as
    // a lone WorkflowData object threw on every render (`workflow.steps`
    // was undefined on an array). Keep the full array; selection above
    // picks which one to display.
    fetch(`/api/delivery/workflow?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: WorkflowData[]) => {
        if (Array.isArray(data)) setWorkflows(data)
      })
      .catch(() => toast('Failed to load workflow', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  const completedCount = workflow?.steps.filter(s => s.status === 'completed').length ?? 0
  const progressPct = workflow && workflow.steps.length > 0 ? Math.round((completedCount / workflow.steps.length) * 100) : 0

  if (loading) return <LoadingScreen />

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--page-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
            Your Delivery Timeline
          </h1>
          {workflow && (
            <p className="text-sm text-gray-500 mt-1">{workflow.service} for {workflow.company}</p>
          )}
        </div>

        {workflows.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {workflows.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkflowId(w.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${w.id === workflow?.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                style={w.id === workflow?.id ? { background: '#015035', borderColor: '#015035' } : undefined}
              >
                {w.service}
              </button>
            ))}
          </div>
        )}

        {!workflow ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <Clock size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No active delivery workflow found.</p>
            <p className="text-xs text-gray-400 mt-1">Contact your account manager for details.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Progress</p>
                <p className="text-sm font-bold" style={{ color: '#015035' }}>{completedCount} / {workflow.steps.length} steps</p>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: '#015035' }}
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gray-200 hidden sm:block" />
              <div className="flex flex-col gap-3">
                {workflow.steps.map((step) => (
                  <StepCard
                    key={step.step}
                    step={step}
                    expanded={expandedStep === step.step}
                    onToggle={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
