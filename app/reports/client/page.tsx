'use client'

import { useEffect, useState, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import {
  FileText, TrendingUp, TrendingDown, Eye, Search, Download,
  Globe, BarChart3, Star, Activity, CheckCircle, RefreshCw,
} from 'lucide-react'

interface Company {
  id: string
  name: string
}

interface ClientReport {
  company: { name: string; id?: string }
  period: { start: string; end: string; label: string }
  seo?: {
    clicks: number
    impressions: number
    avgPosition: number
    ctr: number
    topQueries: Array<{ keyword: string; clicks: number; impressions: number; position: number }>
  }
  traffic?: {
    sessions: number
    users: number
    pageviews: number
    avgSessionDurationSec: number
    bounceRate: number
    topPages: Array<{ path: string; title: string; sessions: number }>
  }
  reputation?: {
    newReviews: number
    averageRating: number
    totalReviews: number
  }
  ranking?: {
    tracked: number
    top3: number
    top10: number
    improved: number
    declined: number
    keywords: Array<{ keyword: string; position: number; change: number }>
  }
  uptime?: {
    sitesMonitored: number
    uptimePercent: number
    incidents: number
  }
}

function firstOfMonth(d = new Date()): string {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return first.toISOString().slice(0, 10)
}
function lastOfMonth(d = new Date()): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function ClientReportsPage() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyName, setCompanyName] = useState('')
  const [gscSiteUrl, setGscSiteUrl] = useState('')
  const [ga4PropertyId, setGa4PropertyId] = useState('')
  const [gbpLocationName, setGbpLocationName] = useState('')
  const [startDate, setStartDate] = useState(firstOfMonth())
  const [endDate, setEndDate] = useState(lastOfMonth())
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ClientReport | null>(null)
  const [bindingLoaded, setBindingLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/crm/companies?limit=500')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setCompanies(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))) })
      .catch(() => {/* non-fatal */})
  }, [])

  // Auto-fill integration properties from client bindings when company changes
  useEffect(() => {
    if (!companyName) {
      setBindingLoaded(false)
      return
    }
    fetch(`/api/client-integrations?company=${encodeURIComponent(companyName)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const b = data[0]
          if (b.gscSiteUrl) setGscSiteUrl(b.gscSiteUrl)
          if (b.ga4PropertyId) setGa4PropertyId(b.ga4PropertyId)
          if (b.gbpLocationName) setGbpLocationName(b.gbpLocationName)
          setBindingLoaded(true)
        } else {
          setGscSiteUrl('')
          setGa4PropertyId('')
          setGbpLocationName('')
          setBindingLoaded(false)
        }
      })
      .catch(() => { setBindingLoaded(false) })
  }, [companyName])

  const companyOptions = useMemo(() => companies.map(c => c.name).sort(), [companies])

  async function generate() {
    if (!companyName) {
      toast('Select a company first', 'error')
      return
    }
    setLoading(true)
    setReport(null)
    try {
      const res = await fetch('/api/client-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          gscSiteUrl: gscSiteUrl || undefined,
          ga4PropertyId: ga4PropertyId || undefined,
          gbpLocationName: gbpLocationName || undefined,
          startDate,
          endDate,
          save: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to build report', 'error')
        setLoading(false)
        return
      }
      setReport(data)
      toast('Report generated', 'success')
    } catch {
      toast('Failed to build report', 'error')
    } finally {
      setLoading(false)
    }
  }

  function printReport() {
    window.print()
  }

  return (
    <>
      <Header title="Client Reports" subtitle="Monthly white-label performance reports" />
      <div className="page-content">

        {/* Controls (hidden when printing) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 print:hidden">
          <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide">Build Report</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client</label>
              <input
                list="company-list"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Select a client..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="company-list">
                {companyOptions.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>

            {companyName && bindingLoaded && (
              <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-[11px] text-emerald-700 font-medium">Integration properties auto-filled from client bindings.</span>
                <a href="/crm/companies" className="text-[11px] text-emerald-800 underline font-semibold ml-auto whitespace-nowrap">Edit bindings →</a>
              </div>
            )}
            {companyName && !bindingLoaded && (
              <div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-[11px] text-amber-700 font-medium">No integration bindings found for this client. Set them up in CRM → Companies to auto-fill.</span>
                <a href="/crm/companies" className="text-[11px] text-amber-800 underline font-semibold ml-auto whitespace-nowrap">Configure →</a>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search Console site URL</label>
              <input
                value={gscSiteUrl}
                onChange={e => setGscSiteUrl(e.target.value)}
                placeholder="sc-domain:example.com or https://example.com/"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GA4 property ID</label>
              <input
                value={ga4PropertyId}
                onChange={e => setGa4PropertyId(e.target.value)}
                placeholder="123456789"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Business Profile location name</label>
              <input
                value={gbpLocationName}
                onChange={e => setGbpLocationName(e.target.value)}
                placeholder="accounts/xxx/locations/yyy"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={loading || !companyName}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90"
              style={{ background: '#015035' }}
            >
              {loading ? 'Building…' : 'Generate Report'}
            </button>
            {report && (
              <button
                onClick={printReport}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Download size={13} /> Save PDF
              </button>
            )}
          </div>
        </div>

        {/* Report preview */}
        {report && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 print:rounded-none print:border-none print:p-0">
            <div className="mb-6 pb-6 border-b border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-2">Performance Report</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{report.company.name}</h1>
              <p className="text-sm text-gray-500">{report.period.label}</p>
              <p className="text-[11px] text-gray-400 mt-3">Prepared by Graviss Marketing</p>
            </div>

            {report.seo && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Search size={16} className="text-emerald-700" />
                  <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Search Performance</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <Metric label="Clicks" value={report.seo.clicks.toLocaleString()} />
                  <Metric label="Impressions" value={report.seo.impressions.toLocaleString()} />
                  <Metric label="Avg CTR" value={`${(report.seo.ctr * 100).toFixed(2)}%`} />
                  <Metric label="Avg Position" value={report.seo.avgPosition.toFixed(1)} />
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Top Queries</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Clicks</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Impr.</th>
                        <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pos.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.seo.topQueries.slice(0, 10).map((q, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-800 truncate max-w-xs">{q.keyword}</td>
                          <td className="px-4 py-2 text-right text-gray-700">{q.clicks}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{q.impressions.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{q.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {report.traffic && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-emerald-700" />
                  <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Website Traffic</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <Metric label="Sessions" value={report.traffic.sessions.toLocaleString()} />
                  <Metric label="Users" value={report.traffic.users.toLocaleString()} />
                  <Metric label="Pageviews" value={report.traffic.pageviews.toLocaleString()} />
                  <Metric label="Bounce Rate" value={`${(report.traffic.bounceRate * 100).toFixed(1)}%`} />
                </div>
                {report.traffic.topPages.length > 0 && (
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Top Pages</th>
                          <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.traffic.topPages.map((p, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-800 truncate max-w-xs">{p.title || p.path}</td>
                            <td className="px-4 py-2 text-right text-gray-700">{p.sessions.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {report.reputation && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={16} className="text-emerald-700" />
                  <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Reputation</h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Average Rating" value={`${report.reputation.averageRating.toFixed(1)} ★`} />
                  <Metric label="New Reviews" value={report.reputation.newReviews.toString()} />
                  <Metric label="Total Reviews" value={report.reputation.totalReviews.toString()} />
                </div>
              </section>
            )}

            {report.ranking && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-700" />
                  <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Keyword Rankings</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  <Metric label="Tracked" value={report.ranking.tracked.toString()} />
                  <Metric label="Top 3" value={report.ranking.top3.toString()} />
                  <Metric label="Top 10" value={report.ranking.top10.toString()} />
                  <Metric label="Improved" value={report.ranking.improved.toString()} positive />
                  <Metric label="Declined" value={report.ranking.declined.toString()} negative />
                </div>
              </section>
            )}

            {report.uptime && (
              <section className="mb-2">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-emerald-700" />
                  <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">Uptime</h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Metric label="Sites Monitored" value={report.uptime.sitesMonitored.toString()} />
                  <Metric label="Uptime (30d)" value={`${report.uptime.uptimePercent}%`} positive />
                  <Metric label="Incidents" value={report.uptime.incidents.toString()} negative={report.uptime.incidents > 0} />
                </div>
              </section>
            )}

            {!report.seo && !report.traffic && !report.reputation && !report.ranking && !report.uptime && (
              <div className="py-12 text-center text-sm text-gray-500">
                No data available for the selected integrations. Make sure Google Search Console,
                Google Analytics, and Business Profile are connected in Settings → Integrations, and
                that this client has properties tracked.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function Metric({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const color = positive ? 'text-emerald-700' : negative ? 'text-red-600' : 'text-gray-900'
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
