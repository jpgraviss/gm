'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Search, Plus, Globe, CheckCircle, Clock, AlertTriangle, Loader2,
  FileSearch, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

interface AuditRow {
  id: string
  website_url: string
  company_name?: string
  audit_type: string
  status: string
  overall_score?: number
  overall_grade?: string
  created_at: string
  completed_at?: string
}

function gradeColor(grade?: string) {
  switch (grade) {
    case 'A': return 'text-green-600 bg-green-50'
    case 'B': return 'text-blue-600 bg-blue-50'
    case 'C': return 'text-yellow-600 bg-yellow-50'
    case 'D': return 'text-orange-600 bg-orange-50'
    case 'F': return 'text-red-600 bg-red-50'
    default: return 'text-gray-500 bg-gray-50'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle size={14} className="text-green-600" />
    case 'running': return <Loader2 size={14} className="text-blue-500 animate-spin" />
    case 'failed': return <AlertTriangle size={14} className="text-red-500" />
    default: return <Clock size={14} className="text-gray-400" />
  }
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [url, setUrl] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [auditType, setAuditType] = useState<string>('full')
  const [running, setRunning] = useState(false)
  const { addToast } = useToast()

  async function loadAudits() {
    try {
      const res = await fetch('/api/ai/audit')
      if (res.ok) setAudits(await res.json())
    } catch {
      addToast('Failed to load audits', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAudits() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runAudit() {
    if (!url.trim()) return
    setRunning(true)
    try {
      const res = await fetch('/api/ai/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), auditType, companyName: companyName.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Audit failed')
      const result = await res.json()
      addToast(`Audit complete — Score: ${result.overallScore}/100`, 'success')
      setShowNew(false)
      setUrl('')
      setCompanyName('')
      loadAudits()
    } catch {
      addToast('Audit failed. Check AI provider configuration.', 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Header title="Website Audits" subtitle="AI-powered website and SEO analysis" />
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FileSearch size={16} />
            <span>{audits.length} audit{audits.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setShowNew(!showNew)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#015035] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Audit
          </button>
        </div>

        {showNew && (
          <div className="bg-white border rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-gray-900">Run New Audit</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company Name (optional)</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="block text-xs font-medium text-gray-600">Audit Type</label>
              <div className="flex gap-2">
                {(['full', 'seo', 'website'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setAuditType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      auditType === t ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t === 'full' ? 'Full Audit' : t === 'seo' ? 'SEO Only' : 'Website Only'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runAudit}
                disabled={!url.trim() || running}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#015035] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {running ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    Run Audit
                  </>
                )}
              </button>
            </div>
            {running && (
              <p className="text-xs text-gray-500 text-center">
                AI is analyzing 8 sections of the website. This may take 1-2 minutes...
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : audits.length === 0 ? (
          <div className="text-center py-16">
            <FileSearch size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm">No audits yet. Run your first website audit to get started.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/60">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Website</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {audits.map(audit => (
                  <tr key={audit.id} className="border-b last:border-0 hover:bg-gray-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-gray-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{audit.website_url.replace(/^https?:\/\//, '')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{audit.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 capitalize">{audit.audit_type}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {audit.overall_score != null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${gradeColor(audit.overall_grade)}`}>
                          {audit.overall_grade} ({audit.overall_score})
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 capitalize text-gray-600">
                        {statusIcon(audit.status)} {audit.status}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {audit.status === 'completed' && (
                        <Link
                          href={`/audits/${audit.id}`}
                          className="inline-flex items-center gap-1 text-[#015035] text-xs font-medium hover:underline"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
