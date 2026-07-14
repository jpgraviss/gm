'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { generateAuditPdf, downloadBlob } from '@/lib/pdf-audit'
import { gradeColorHex } from '@/lib/brand'
import {
  Globe, ArrowLeft, Download, Loader2,
  AlertTriangle, TrendingUp, Trash2,
} from 'lucide-react'
import Link from 'next/link'

interface SectionResult {
  name: string
  score: number
  grade: string
  findings: string[]
  recommendations: string[]
}

interface AuditData {
  id: string
  website_url: string
  company_name?: string
  audit_type: string
  status: string
  overall_score: number
  overall_grade: string
  summary: string
  sections: SectionResult[]
  created_at: string
  completed_at?: string
}

// Brand-consistent grade colors (matches lib/brand.ts GRADE_COLORS, the same
// mapping used in the PDF export) instead of generic Tailwind semantic
// colors that had no relationship to the app's actual brand palette.
function gradeHex(grade: string): string {
  return gradeColorHex(grade)
}

function gradeBgStyle(grade: string): { backgroundColor: string; borderColor: string } {
  const hex = gradeColorHex(grade)
  return { backgroundColor: `${hex}14`, borderColor: `${hex}40` }
}

function scoreBarHex(score: number): string {
  if (score >= 90) return gradeColorHex('A')
  if (score >= 80) return gradeColorHex('B')
  if (score >= 70) return gradeColorHex('C')
  if (score >= 60) return gradeColorHex('D')
  return gradeColorHex('F')
}

export default function AuditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ai/audit?id=${id}`)
        if (!res.ok) throw new Error('Not found')
        setAudit(await res.json())
      } catch {
        toast('Audit not found', 'error')
        router.push('/audits')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDownloadPdf() {
    if (!audit) return
    setDownloading(true)
    try {
      const blob = await generateAuditPdf(audit)
      const filename = `audit-${(audit.company_name || audit.website_url).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date(audit.created_at).toISOString().slice(0, 10)}.pdf`
      downloadBlob(blob, filename)
    } catch {
      toast('PDF download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/ai/audit?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Audit deleted', 'success')
      router.push('/audits')
    } catch {
      toast('Failed to delete audit', 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Loading Audit..." />
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      </>
    )
  }

  if (!audit) return null

  const sections = Array.isArray(audit.sections) ? audit.sections : []

  return (
    <>
      <Header title="Audit Report" subtitle={audit.company_name || audit.website_url} />
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/audits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={14} /> Back to Audits
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#015035] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download PDF
            </button>
          </div>
        </div>

        {/* Overview Card — dark brand header band, matches the PDF export */}
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6" style={{ background: '#012b1e' }}>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                style={{ background: gradeHex(audit.overall_grade) }}
              >
                {audit.overall_grade}
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{audit.overall_score}/100</div>
                <div className="text-sm text-gray-300">Overall Score</div>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Globe size={14} />
                <a href={audit.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {audit.website_url}
                </a>
              </div>
              {audit.company_name && (
                <div className="text-sm text-gray-300">Company: {audit.company_name}</div>
              )}
              <div className="text-xs font-semibold tracking-wide" style={{ color: '#CC7853' }}>
                {(audit.audit_type === 'full' ? 'FULL AUDIT' : audit.audit_type === 'seo' ? 'SEO AUDIT' : 'WEBSITE AUDIT')} &middot;{' '}
                {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        {audit.summary && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-xs uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: '#1B211D' }}>
              <span className="inline-block w-1 h-4 rounded-sm" style={{ background: '#015035' }} />
              Executive Summary
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">{audit.summary}</p>
          </div>
        )}

        {/* Score Overview */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-xs uppercase tracking-wide mb-4 flex items-center gap-2" style={{ color: '#1B211D' }}>
            <span className="inline-block w-1 h-4 rounded-sm" style={{ background: '#015035' }} />
            Section Scores
          </h2>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-40 text-sm text-gray-600 shrink-0">{s.name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${s.score}%`, background: scoreBarHex(s.score) }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-semibold" style={{ color: gradeHex(s.grade) }}>
                  {s.grade} ({s.score})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Sections */}
        {sections.map((section, i) => (
          <div key={i} className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">{section.name}</h2>
              <span className="px-3 py-1 rounded-lg text-sm font-semibold" style={{ ...gradeBgStyle(section.grade), color: gradeHex(section.grade) }}>
                {section.grade} — {section.score}/100
              </span>
            </div>

            {section.findings.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Findings</h3>
                <ul className="space-y-1.5">
                  {section.findings.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertTriangle size={13} className="text-yellow-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {section.recommendations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommendations</h3>
                <ul className="space-y-1.5">
                  {section.recommendations.map((r, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                      <TrendingUp size={13} className="text-green-500 shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </main>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this audit?"
          description="This permanently deletes the audit and its results. This can't be undone."
          confirmLabel={deleting ? 'Deleting...' : 'Delete'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

