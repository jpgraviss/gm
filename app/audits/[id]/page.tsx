'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { generatePdf, downloadPdf } from '@/lib/pdf-generator'
import {
  Globe, ArrowLeft, Download, Loader2,
  CheckCircle, AlertTriangle, TrendingUp,
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

function gradeColor(grade: string) {
  switch (grade) {
    case 'A': return 'text-green-600'
    case 'B': return 'text-blue-600'
    case 'C': return 'text-yellow-600'
    case 'D': return 'text-orange-600'
    case 'F': return 'text-red-600'
    default: return 'text-gray-500'
  }
}

function gradeBg(grade: string) {
  switch (grade) {
    case 'A': return 'bg-green-50 border-green-200'
    case 'B': return 'bg-blue-50 border-blue-200'
    case 'C': return 'bg-yellow-50 border-yellow-200'
    case 'D': return 'bg-orange-50 border-orange-200'
    case 'F': return 'bg-red-50 border-red-200'
    default: return 'bg-gray-50 border-gray-200'
  }
}

function scoreBarColor(score: number) {
  if (score >= 90) return 'bg-green-500'
  if (score >= 80) return 'bg-blue-500'
  if (score >= 70) return 'bg-yellow-500'
  if (score >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function AuditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ai/audit?id=${id}`)
        if (!res.ok) throw new Error('Not found')
        setAudit(await res.json())
      } catch {
        addToast('Audit not found', 'error')
        router.push('/audits')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDownloadPdf() {
    if (!audit) return
    setDownloading(true)
    try {
      const html = buildReportHtml(audit)
      const blob = generatePdf(html, {
        title: `Website Audit — ${audit.company_name || audit.website_url}`,
        orientation: 'portrait',
      })
      const filename = `audit-${(audit.company_name || audit.website_url).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date(audit.created_at).toISOString().slice(0, 10)}.pdf`
      downloadPdf(blob, filename)
    } catch {
      addToast('PDF download failed', 'error')
    } finally {
      setDownloading(false)
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
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#015035] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download PDF
          </button>
        </div>

        {/* Overview Card */}
        <div className={`rounded-xl border p-6 ${gradeBg(audit.overall_grade)}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${gradeColor(audit.overall_grade)}`}>
                {audit.overall_grade}
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{audit.overall_score}/100</div>
                <div className="text-sm text-gray-500">Overall Score</div>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Globe size={14} />
                <a href={audit.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {audit.website_url}
                </a>
              </div>
              {audit.company_name && (
                <div className="text-sm text-gray-600">Company: {audit.company_name}</div>
              )}
              <div className="text-xs text-gray-500">
                {audit.audit_type === 'full' ? 'Full Audit' : audit.audit_type === 'seo' ? 'SEO Audit' : 'Website Audit'} &middot;{' '}
                {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        {audit.summary && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2">Executive Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed">{audit.summary}</p>
          </div>
        )}

        {/* Score Overview */}
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Section Scores</h2>
          <div className="space-y-3">
            {sections.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-40 text-sm text-gray-600 shrink-0">{s.name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreBarColor(s.score)}`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
                <div className={`w-16 text-right text-sm font-semibold ${gradeColor(s.grade)}`}>
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
              <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${gradeColor(section.grade)} ${gradeBg(section.grade)}`}>
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
    </>
  )
}

function buildReportHtml(audit: AuditData): string {
  const sections = Array.isArray(audit.sections) ? audit.sections : []
  return `
    <div>
      <h1>Website Audit Report</h1>
      <p><strong>Website:</strong> ${audit.website_url}</p>
      ${audit.company_name ? `<p><strong>Company:</strong> ${audit.company_name}</p>` : ''}
      <p><strong>Date:</strong> ${new Date(audit.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      <p><strong>Overall Score:</strong> ${audit.overall_score}/100 (Grade: ${audit.overall_grade})</p>
      <br/>
      <h2>Executive Summary</h2>
      <p>${audit.summary || 'No summary available.'}</p>
      <br/>
      <h2>Section Scores</h2>
      ${sections.map(s => `<p>${s.name}: ${s.score}/100 (${s.grade})</p>`).join('')}
      <br/>
      ${sections.map(s => `
        <h2>${s.name} — ${s.grade} (${s.score}/100)</h2>
        <h3>Findings</h3>
        <ul>${s.findings.map(f => `<li>${f}</li>`).join('')}</ul>
        <h3>Recommendations</h3>
        <ul>${s.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        <br/>
      `).join('')}
    </div>
  `
}
