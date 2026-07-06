'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Globe, BarChart3, CheckCircle, Minus, Send, Eye, X,
  Loader2, Search, TrendingUp, MousePointerClick, Users,
  ArrowUp, ArrowDown, Calendar, Mail, Building,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Integration {
  id: string
  company_name: string
  company_id: string
  gsc_site_url: string | null
  ga4_property_id: string | null
  gbp_location_name: string | null
  portal_enabled: boolean
  seo_reports_enabled: boolean
  seo_report_recipients: string | null
  last_seo_report_at: string | null
}

interface ReportSnapshot {
  period: string
  clicks: number
  impressions: number
  avg_position: number
  sessions: number
  clicks_change?: number
  impressions_change?: number
  sessions_change?: number
}

/* ------------------------------------------------------------------ */
/*  Toggle                                                             */
/* ------------------------------------------------------------------ */

function Toggle({ enabled, loading, onChange }: { enabled: boolean; loading?: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      disabled={loading}
      className="rounded-full relative flex items-center px-0.5 transition-colors flex-shrink-0 disabled:opacity-50"
      style={{ background: enabled ? '#015035' : '#d1d5db', width: '40px', height: '22px' }}
    >
      <div
        className="w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
        style={{ transform: enabled ? 'translateX(18px)' : 'translateX(0px)' }}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Integration status icon                                            */
/* ------------------------------------------------------------------ */

function IntegrationIcon({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      {active ? (
        <CheckCircle size={14} className="text-emerald-600" />
      ) : (
        <Minus size={14} className="text-gray-300" />
      )}
      <span className="text-[11px] text-gray-500">{label}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  KPI card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 flex-1 min-w-[200px]">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#01503510' }}>
        <Icon size={18} style={{ color: '#015035' }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isCurrentMonth(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function formatPosition(n: number): string {
  return n.toFixed(1)
}

/* ------------------------------------------------------------------ */
/*  Change badge                                                       */
/* ------------------------------------------------------------------ */

function ChangeBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return null
  const positive = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SeoReportsPage() {
  const { toast } = useToast()

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Toggles in flight
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Send in flight
  const [sendingCompany, setSendingCompany] = useState<string | null>(null)

  // Preview modal
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewCompany, setPreviewCompany] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Report history
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)
  const [history, setHistory] = useState<ReportSnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  /* ---- Fetch integrations ---- */
  const fetchIntegrations = useCallback(() => {
    fetch('/api/seo-reports')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        if (Array.isArray(data)) setIntegrations(data)
      })
      .catch(() => toast('Failed to load SEO report data', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { fetchIntegrations() }, [fetchIntegrations])

  /* ---- Toggle auto-reports ---- */
  async function handleToggle(integration: Integration) {
    const id = integration.id
    setTogglingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/seo-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, seoReportsEnabled: !integration.seo_reports_enabled }),
      })
      if (!res.ok) throw new Error()
      setIntegrations(prev =>
        prev.map(i => i.id === id ? { ...i, seo_reports_enabled: !i.seo_reports_enabled } : i)
      )
      toast(
        `Auto-reports ${!integration.seo_reports_enabled ? 'enabled' : 'disabled'} for ${integration.company_name}`,
        'success',
      )
    } catch {
      toast('Failed to update report settings', 'error')
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  /* ---- Send report now ---- */
  async function handleSend(companyName: string) {
    if (!confirm(`Send SEO report for ${companyName} now?`)) return
    setSendingCompany(companyName)
    try {
      const res = await fetch('/api/seo-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.error) {
        toast(data.error, 'error')
      } else {
        toast(`Report sent to ${data.recipient || companyName}`, 'success')
        fetchIntegrations()
      }
    } catch {
      toast('Failed to send report', 'error')
    } finally {
      setSendingCompany(null)
    }
  }

  /* ---- Preview report ---- */
  async function handlePreview(companyName: string) {
    setPreviewCompany(companyName)
    setPreviewLoading(true)
    setPreviewHtml(null)
    try {
      const res = await fetch('/api/seo-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, preview: true }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.error) {
        toast(data.error, 'error')
        setPreviewCompany('')
      } else {
        setPreviewHtml(data.html || '<p style="padding:24px;color:#666;">No report content available.</p>')
      }
    } catch {
      toast('Failed to generate preview', 'error')
      setPreviewCompany('')
    } finally {
      setPreviewLoading(false)
    }
  }

  /* ---- Fetch report history ---- */
  async function handleExpandRow(companyId: string) {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null)
      return
    }
    setExpandedCompanyId(companyId)
    setHistoryLoading(true)
    setHistory([])
    try {
      const res = await fetch(`/api/seo-reports/${companyId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : [])
    } catch {
      toast('Failed to load report history', 'error')
      setExpandedCompanyId(null)
    } finally {
      setHistoryLoading(false)
    }
  }

  /* ---- Computed values ---- */
  const filtered = integrations.filter(i =>
    i.company_name.toLowerCase().includes(search.toLowerCase()),
  )

  const totalCompanies = integrations.length
  const enabledCount = integrations.filter(i => i.seo_reports_enabled).length
  const sentThisMonth = integrations.filter(i => isCurrentMonth(i.last_seo_report_at)).length

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <Header title="SEO Reports" subtitle="Automated monthly client reports" />

      <div className="page-content">
        {/* ---- KPI cards + preview template ---- */}
        <div className="flex flex-wrap items-end gap-4">
          <KpiCard icon={Building} label="Total Companies" value={loading ? '--' : totalCompanies} />
          <KpiCard icon={Mail} label="Auto-Reports Enabled" value={loading ? '--' : enabledCount} />
          <KpiCard icon={Calendar} label="Reports Sent This Month" value={loading ? '--' : sentThisMonth} />
          <button
            onClick={async () => {
              setPreviewLoading(true)
              setPreviewCompany('Email Template Preview')
              setPreviewHtml(null)
              try {
                const res = await fetch('/api/seo-reports/preview-template')
                const data = await res.json()
                setPreviewHtml(data.html)
              } catch {
                toast('Failed to load template preview', 'error')
                setPreviewHtml(null)
                setPreviewLoading(false)
              } finally {
                setPreviewLoading(false)
              }
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Eye size={13} /> Preview Email Template
          </button>
        </div>

        {/* ---- Search bar ---- */}
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 transition-colors"
          />
        </div>

        {/* ---- Company table ---- */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Integrations
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Auto-Report
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Recipients
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Last Sent
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Loader2 size={24} className="animate-spin text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-400 mt-2">Loading integrations...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Globe size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        {search ? 'No companies match your search' : 'No client integrations configured yet'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(integration => (
                    <Fragment key={integration.id}>
                      <tr
                        className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => handleExpandRow(integration.company_id)}
                      >
                        {/* Company name */}
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{integration.company_name}</p>
                        </td>

                        {/* Integration icons */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <IntegrationIcon active={!!integration.gsc_site_url} label="GSC" />
                            <IntegrationIcon active={!!integration.ga4_property_id} label="GA4" />
                            <IntegrationIcon active={!!integration.gbp_location_name} label="GBP" />
                          </div>
                        </td>

                        {/* Auto-report toggle */}
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <Toggle
                              enabled={integration.seo_reports_enabled}
                              loading={togglingIds.has(integration.id)}
                              onChange={() => handleToggle(integration)}
                            />
                          </div>
                        </td>

                        {/* Recipients */}
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-600 truncate max-w-[200px]">
                            {integration.seo_report_recipients || 'Primary contact'}
                          </p>
                        </td>

                        {/* Last sent */}
                        <td className="px-4 py-3">
                          <p className={`text-sm ${integration.last_seo_report_at ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                            {formatDate(integration.last_seo_report_at)}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePreview(integration.company_name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            >
                              <Eye size={13} />
                              Preview
                            </button>
                            <button
                              onClick={() => handleSend(integration.company_name)}
                              disabled={sendingCompany === integration.company_name}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                              style={{ background: '#015035' }}
                            >
                              {sendingCompany === integration.company_name ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Send size={13} />
                              )}
                              Send Now
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ---- Expanded history row ---- */}
                      {expandedCompanyId === integration.company_id && (
                        <tr key={`${integration.id}-history`} className="bg-gray-50/50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="bg-white rounded-xl border border-gray-100 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <BarChart3 size={13} />
                                Report History — {integration.company_name}
                              </h4>

                              {historyLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 size={18} className="animate-spin text-gray-400" />
                                </div>
                              ) : history.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">No report history available</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b border-gray-100">
                                        <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Period</th>
                                        <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Clicks</th>
                                        <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Impressions</th>
                                        <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Avg Position</th>
                                        <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Sessions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {history.map((snapshot, idx) => (
                                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                                          <td className="px-3 py-2.5 text-sm font-medium text-gray-700">{snapshot.period}</td>
                                          <td className="px-3 py-2.5 text-right">
                                            <span className="text-sm text-gray-900">{formatNumber(snapshot.clicks)}</span>
                                            <ChangeBadge value={snapshot.clicks_change} />
                                          </td>
                                          <td className="px-3 py-2.5 text-right">
                                            <span className="text-sm text-gray-900">{formatNumber(snapshot.impressions)}</span>
                                            <ChangeBadge value={snapshot.impressions_change} />
                                          </td>
                                          <td className="px-3 py-2.5 text-right text-sm text-gray-900">
                                            {formatPosition(snapshot.avg_position)}
                                          </td>
                                          <td className="px-3 py-2.5 text-right">
                                            <span className="text-sm text-gray-900">{formatNumber(snapshot.sessions)}</span>
                                            <ChangeBadge value={snapshot.sessions_change} />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Table footer summary ---- */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-right">
            Showing {filtered.length} of {totalCompanies} companies
          </p>
        )}
      </div>

      {/* ---- Preview modal ---- */}
      {(previewHtml !== null || previewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Report Preview</h3>
                <p className="text-xs text-gray-500 mt-0.5">{previewCompany}</p>
              </div>
              <button
                onClick={() => { setPreviewHtml(null); setPreviewCompany('') }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-gray-400 mb-3" />
                  <p className="text-sm text-gray-400">Generating report preview...</p>
                </div>
              ) : (
                <div
                  className="bg-white border border-gray-200 rounded-lg mx-auto shadow-sm"
                  style={{ maxWidth: '640px' }}
                  dangerouslySetInnerHTML={{ __html: previewHtml || '' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
