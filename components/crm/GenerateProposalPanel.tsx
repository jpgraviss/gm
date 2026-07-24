'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, Sparkles, FileText, Loader2, AlertTriangle } from 'lucide-react'
import type { Proposal } from '@/lib/types'
import { aiSourceLabel } from '@/lib/utils'

interface FormOption {
  id: string
  name: string
}

interface SubmissionOption {
  id: string
  createdAt: string
  data: Record<string, unknown>
}

interface Props {
  onGenerated: (proposal: Proposal) => void
  onClose: () => void
}

// Replaces the old ProposalBuilderPanel (a manual item/addon picker with a
// client-side jsPDF export). This panel instead drives the AI proposal
// generator: pick the client's intake form submission (every client's
// intake form is custom-built per the Proposal Generator kit, no fixed
// schema — see lib/proposal-generator.ts), generate, review the rendered
// PDF and any AI-flagged assumptions, done. The resulting proposal is
// already saved as a Draft — if the draft isn't right, generate again or
// delete it from the list, same as any other Draft proposal.
export default function GenerateProposalPanel({ onGenerated, onClose }: Props) {
  const [forms, setForms] = useState<FormOption[]>([])
  const [formId, setFormId] = useState('')
  const [submissions, setSubmissions] = useState<SubmissionOption[]>([])
  const [submissionId, setSubmissionId] = useState('')
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ pdfUrl: string | null; notes: string; source: string } | null>(null)

  useEffect(() => {
    fetch('/api/forms')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setForms((Array.isArray(data) ? data : (data.items ?? [])).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!formId) { setSubmissions([]); setSubmissionId(''); return }
    setLoadingSubmissions(true)
    fetch(`/api/forms/${formId}/submissions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSubmissions(Array.isArray(data) ? data : []))
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingSubmissions(false))
  }, [formId])

  async function generate() {
    if (!submissionId) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to generate proposal')
        return
      }
      setResult({ pdfUrl: json.pdfUrl, notes: json.notes, source: json.source })
      onGenerated(json.proposal)
    } catch {
      setError('Network error — could not generate proposal')
    } finally {
      setGenerating(false)
    }
  }

  const sourceLabel = aiSourceLabel(result?.source)

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(560px, 100vw)' }}>

        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400" /> Generate Proposal
            </h2>
            <p className="text-white/50 text-xs mt-0.5">Draft a branded proposal PDF from a client&apos;s intake form</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {!result && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Intake Form</label>
                <select
                  value={formId}
                  onChange={e => setFormId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Select the client&apos;s intake form...</option>
                  {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              {formId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Submission</label>
                  {loadingSubmissions ? (
                    <p className="text-xs text-gray-400">Loading submissions...</p>
                  ) : submissions.length === 0 ? (
                    <p className="text-xs text-gray-400">No submissions yet for this form.</p>
                  ) : (
                    <select
                      value={submissionId}
                      onChange={e => setSubmissionId(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Select a submission...</option>
                      {submissions.map(s => (
                        <option key={s.id} value={s.id}>
                          {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {s.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <FileText size={14} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Draft created</p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">Source: {sourceLabel}</p>
                </div>
              </div>

              {result.notes && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Review before sending</p>
                    <p className="text-[11px] text-amber-700 mt-0.5 whitespace-pre-wrap">{result.notes}</p>
                  </div>
                </div>
              )}

              {result.pdfUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '60vh' }}>
                  <iframe src={result.pdfUrl} className="w-full h-full" title="Generated proposal preview" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {!result ? (
            <>
              <button
                onClick={generate}
                disabled={!submissionId || generating}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: '#015035' }}
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? 'Generating...' : 'Generate'}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setResult(null); setSubmissionId('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Generate Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
