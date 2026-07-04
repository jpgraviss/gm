'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, CheckCircle2, Clock, Circle, ChevronDown, ChevronUp,
  Download, FileText, Mail, ExternalLink, Calendar, BookOpen, BarChart3,
  Package,
} from 'lucide-react'
import Link from 'next/link'

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
  helpArticles?: { title: string; url: string }[]
  deliverables?: { name: string; url: string }[]
  reportUrl?: string
  metricsPreview?: { label: string; value: string }[]
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

      {expanded && step.details && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <StepDetails step={step.step} details={step.details} />
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
      return (
        <>
          {details.deliverables && details.deliverables.length > 0 ? (
            <div className="space-y-1.5">
              {details.deliverables.map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#015035] hover:underline font-medium">
                  <Download size={13} /> {d.name}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No deliverables uploaded yet.</p>
          )}
        </>
      )
    case 8:
      return (
        <>
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

export default function PortalWorkflowPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  useEffect(() => {
    if (!company) {
      requestAnimationFrame(() => setLoading(false))
      return
    }
    fetch(`/api/delivery/workflow?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: WorkflowData | null) => {
        if (data) setWorkflow(data)
      })
      .catch(() => toast('Failed to load workflow', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  const completedCount = workflow?.steps.filter(s => s.status === 'completed').length ?? 0
  const progressPct = workflow && workflow.steps.length > 0 ? Math.round((completedCount / workflow.steps.length) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft size={14} /> Back to Portal
        </Link>

        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
            Your Delivery Timeline
          </h1>
          {workflow && (
            <p className="text-sm text-gray-500 mt-1">{workflow.service} for {workflow.company}</p>
          )}
        </div>

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
