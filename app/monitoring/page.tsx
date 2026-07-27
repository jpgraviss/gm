'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  Activity, X, Trash2, RefreshCw, Pause, Play, Pencil, Globe, AlertCircle,
  CheckCircle2, Clock, Shield, ShieldAlert, Puzzle, Palette, ChevronDown,
  ChevronUp, AlertTriangle, Lock, Eye, EyeOff,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteStatus = 'up' | 'down' | 'degraded' | 'paused'

interface MonitoredSite {
  id: string
  companyId: string | null
  companyName: string
  url: string
  checkIntervalMinutes: number
  alertEmails: string[]
  status: SiteStatus
  lastCheckAt: string | null
  lastUpAt: string | null
  lastDownAt: string | null
  responseTimeMs: number | null
  uptime30d: number | null
  isWordPress?: boolean
}

interface UptimeCheckRow {
  id: string
  checkedAt: string
  statusCode: number | null
  responseTimeMs: number | null
  up: boolean
  errorMessage: string | null
}

interface SiteDetail extends MonitoredSite {
  recentChecks: UptimeCheckRow[]
}

interface CompanyOption {
  id: string
  name: string
}

interface WPData {
  checked: boolean
  isWordPress: boolean
  wpVersion: string | null
  siteTitle: string | null
  plugins: Array<{ name: string; slug: string; version: string; status: string; updateAvailable: boolean; newVersion?: string }>
  themes: Array<{ name: string; slug: string; version: string; active: boolean }>
  coreUpdateAvailable: boolean
  securityHeaders: Record<string, boolean>
  loginPageExposed: boolean
  xmlRpcEnabled: boolean
  checkedAt: string | null
  hasCredentials?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColors(status: SiteStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'up':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Up' }
    case 'down':
      return { bg: 'bg-red-50', text: 'text-red-700', label: 'Down' }
    case 'degraded':
      return { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Degraded' }
    case 'paused':
      return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Paused' }
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return 'Never'
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function formatResponse(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatUptime(pct: number | null): string {
  if (pct == null) return '—'
  return `${pct.toFixed(2)}%`
}

const FOREST = '#015035'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<MonitoredSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SiteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)

  useEffect(() => {
    loadSites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSites() {
    try {
      const res = await fetch('/api/monitored-sites')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      if (Array.isArray(data)) setSites(data)
    } catch {
      toast('Failed to load monitored sites', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(id: string) {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/monitored-sites/${id}`)
      if (!res.ok) throw new Error('detail failed')
      const data = await res.json()
      setDetail(data as SiteDetail)
    } catch {
      toast('Failed to load site detail', 'error')
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function createSite(input: { companyName: string; companyId: string | null; url: string; alertEmails: string }) {
    try {
      const res = await fetch('/api/monitored-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: input.companyName,
          companyId: input.companyId,
          url: input.url,
          alertEmails: input.alertEmails.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error ?? 'Failed to create site', 'error')
        return
      }
      const created = await res.json()
      setSites(prev => [created, ...prev])
      setShowAdd(false)
      toast('Monitor added', 'success')
    } catch {
      toast('Failed to create site', 'error')
    }
  }

  async function runCheck(id: string) {
    // Guards against a double-click firing two concurrent checks for the
    // same site — recordCheck() itself is now race-safe (atomic transition
    // + alert claim), but there's no reason to let the UI trivially trigger
    // the race in the first place.
    if (checkingId === id) return
    setCheckingId(id)
    try {
      const res = await fetch(`/api/monitored-sites/${id}/check`, { method: 'POST' })
      if (!res.ok) {
        toast('Check failed', 'error')
        return
      }
      toast('Check complete', 'success')
      await loadSites()
      if (selectedId === id) await openDetail(id)
    } catch {
      toast('Check failed', 'error')
    } finally {
      setCheckingId(prev => (prev === id ? null : prev))
    }
  }

  async function togglePause(site: MonitoredSite) {
    const newStatus: SiteStatus = site.status === 'paused' ? 'up' : 'paused'
    try {
      const res = await fetch(`/api/monitored-sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        toast('Failed to update', 'error')
        return
      }
      const updated = await res.json()
      setSites(prev => prev.map(s => s.id === updated.id ? updated : s))
      if (detail?.id === updated.id) setDetail({ ...detail, ...updated })
      toast(newStatus === 'paused' ? 'Monitor paused' : 'Monitor resumed', 'success')
    } catch {
      toast('Failed to update', 'error')
    }
  }

  async function deleteSite(id: string) {
    if (!confirm('Delete this monitor and all its check history?')) return
    try {
      const res = await fetch(`/api/monitored-sites/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error ?? 'Failed to delete', 'error')
        return
      }
      setSites(prev => prev.filter(s => s.id !== id))
      if (selectedId === id) { setSelectedId(null); setDetail(null) }
      toast('Monitor deleted', 'success')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  async function saveEdits(patch: { companyName: string; url: string; alertEmails: string[] }) {
    if (!detail) return
    try {
      const res = await fetch(`/api/monitored-sites/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        toast('Failed to save', 'error')
        return
      }
      const updated = await res.json()
      setSites(prev => prev.map(s => s.id === updated.id ? updated : s))
      setDetail({ ...detail, ...updated })
      toast('Saved', 'success')
    } catch {
      toast('Failed to save', 'error')
    }
  }

  // Summary stats
  const upCount = sites.filter(s => s.status === 'up').length
  const downCount = sites.filter(s => s.status === 'down').length
  const degradedCount = sites.filter(s => s.status === 'degraded').length
  const wpCount = sites.filter(s => s.isWordPress).length

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <>
      <Header
        title="Website Monitoring"
        subtitle="Uptime & WordPress health for client sites"
        action={{ label: 'Add Site', onClick: () => setShowAdd(true) }}
      />
      <div className="page-content">
        {/* Summary KPIs */}
        {sites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-100">
                <CheckCircle2 size={18} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{upCount}</p>
                <p className="text-[11px] text-gray-500">Sites Up</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-100">
                <AlertCircle size={18} className="text-red-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{downCount}</p>
                <p className="text-[11px] text-gray-500">Down</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{degradedCount}</p>
                <p className="text-[11px] text-gray-500">Degraded</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#e0f0ea' }}>
                <Globe size={18} style={{ color: FOREST }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{wpCount}</p>
                <p className="text-[11px] text-gray-500">WordPress</p>
              </div>
            </div>
          </div>
        )}

        {sites.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Activity size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No sites monitored yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Add a site to start tracking uptime and response time.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: FOREST }}
            >
              Add Site
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              <div className="col-span-4">Site</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">30d Uptime</div>
              <div className="col-span-2">Response</div>
              <div className="col-span-2">Last Check</div>
            </div>
            <div className="divide-y divide-gray-100">
              {sites.map(site => {
                const colors = statusColors(site.status)
                return (
                  <button
                    key={site.id}
                    onClick={() => openDetail(site.id)}
                    className="w-full grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Globe size={15} className="text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{site.companyName}</p>
                          {site.isWordPress && (
                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">WP</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{site.url}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {colors.label}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-gray-700">{formatUptime(site.uptime30d)}</div>
                    <div className="col-span-2 text-sm text-gray-700">{formatResponse(site.responseTimeMs)}</div>
                    <div className="col-span-2 text-xs text-gray-500">{formatRelative(site.lastCheckAt)}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddSiteModal
          onClose={() => setShowAdd(false)}
          onCreate={createSite}
        />
      )}

      {selectedId && (
        <SiteDetailPanel
          loading={detailLoading}
          detail={detail}
          checking={checkingId === selectedId}
          onClose={() => { setSelectedId(null); setDetail(null) }}
          onRunCheck={() => runCheck(selectedId)}
          onTogglePause={() => detail && togglePause(detail)}
          onDelete={() => deleteSite(selectedId)}
          onSave={saveEdits}
        />
      )}
    </>
  )
}

// ─── Add Site Modal ───────────────────────────────────────────────────────────

function AddSiteModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: { companyName: string; companyId: string | null; url: string; alertEmails: string }) => void
}) {
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [url, setUrl] = useState('')
  const [alertEmails, setAlertEmails] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    // /api/crm/companies is cursor-paginated (100/page) — a raw fetch()
    // here silently missed every company past the most-recently-created
    // 100. fetchAllPages() follows X-Next-Cursor to completion instead.
    fetchAllPages<{ id: string; name: string }>('/api/crm/companies')
      .then(data => {
        setCompanies(
          data
            .filter((c): c is { id: string; name: string } =>
              typeof c === 'object' && c !== null &&
              typeof (c as { id?: unknown }).id === 'string' &&
              typeof (c as { name?: unknown }).name === 'string'
            )
            .map(c => ({ id: c.id, name: c.name })),
        )
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  const filtered = useMemo(() => {
    const q = companyName.trim().toLowerCase()
    if (!q) return companies.slice(0, 8)
    return companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [companyName, companies])

  function pickCompany(c: CompanyOption) {
    setCompanyName(c.name)
    setCompanyId(c.id)
    setShowDropdown(false)
  }

  function submit() {
    if (!companyName.trim()) return
    if (!url.trim()) return
    onCreate({ companyName: companyName.trim(), companyId, url: url.trim(), alertEmails })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Add Monitored Site</h3>
            <p className="text-xs text-gray-500 mt-0.5">We&apos;ll check it every 5 minutes</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="relative">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company</label>
            <input
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setCompanyId(null); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Start typing…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {showDropdown && filtered.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => pickCompany(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://client-site.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Alert Emails</label>
            <input
              value={alertEmails}
              onChange={e => setAlertEmails(e.target.value)}
              placeholder="ops@company.com, founder@company.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Comma-separated. Notified on up → down transitions.</p>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
            style={{ background: FOREST }}
          >
            Add Monitor
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function SiteDetailPanel({
  loading,
  detail,
  checking,
  onClose,
  onRunCheck,
  onTogglePause,
  onDelete,
  onSave,
}: {
  loading: boolean
  detail: SiteDetail | null
  checking: boolean
  onClose: () => void
  onRunCheck: () => void
  onTogglePause: () => void
  onDelete: () => void
  onSave: (patch: { companyName: string; url: string; alertEmails: string[] }) => void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftEmails, setDraftEmails] = useState('')
  const [detailTab, setDetailTab] = useState<'uptime' | 'wordpress'>('uptime')
  const [wpData, setWpData] = useState<WPData | null>(null)
  const [wpLoading, setWpLoading] = useState(false)
  const [wpChecking, setWpChecking] = useState(false)

  useEffect(() => {
    if (detail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftName(detail.companyName)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftUrl(detail.url)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftEmails((detail.alertEmails ?? []).join(', '))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetailTab('uptime')
      loadWPData(detail.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id])

  async function loadWPData(siteId: string) {
    setWpLoading(true)
    try {
      const res = await fetch(`/api/monitored-sites/${siteId}/wordpress`)
      if (res.ok) {
        const data = await res.json()
        setWpData(data)
      }
    } catch { /* non-fatal */ }
    finally { setWpLoading(false) }
  }

  async function runWPCheck() {
    if (!detail) return
    setWpChecking(true)
    try {
      const res = await fetch(`/api/monitored-sites/${detail.id}/wordpress`, { method: 'POST' })
      if (!res.ok) {
        toast('WordPress check failed', 'error')
        return
      }
      toast('WordPress check complete', 'success')
      await loadWPData(detail.id)
    } catch {
      toast('WordPress check failed', 'error')
    } finally {
      setWpChecking(false)
    }
  }

  function commitEdit() {
    onSave({
      companyName: draftName.trim(),
      url: draftUrl.trim(),
      alertEmails: draftEmails.split(',').map(s => s.trim()).filter(Boolean),
    })
    setEditing(false)
  }

  const colors = detail ? statusColors(detail.status) : null

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(680px,100vw)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-sm truncate">{detail?.companyName ?? 'Loading…'}</h2>
              {detail?.isWordPress && (
                <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">WP</span>
              )}
            </div>
            <p className="text-white/60 text-xs truncate">{detail?.url}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"><X size={16} className="text-white/70" /></button>
        </div>

        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingScreen />
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setDetailTab('uptime')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${detailTab === 'uptime' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Activity size={13} className="inline mr-1 mb-0.5" />
                Uptime
              </button>
              <button
                onClick={() => setDetailTab('wordpress')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${detailTab === 'wordpress' ? 'text-emerald-700 border-b-2 border-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Globe size={13} className="inline mr-1 mb-0.5" />
                WordPress
              </button>
            </div>

            {detailTab === 'uptime' ? (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Status"
                    value={colors?.label ?? '—'}
                    valueClass={colors?.text ?? 'text-gray-700'}
                    icon={detail.status === 'up'
                      ? <CheckCircle2 size={14} className="text-emerald-600" />
                      : detail.status === 'down'
                        ? <AlertCircle size={14} className="text-red-600" />
                        : <Activity size={14} className="text-amber-600" />}
                  />
                  <StatCard label="30d Uptime" value={formatUptime(detail.uptime30d)} />
                  <StatCard label="Response" value={formatResponse(detail.responseTimeMs)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Last Check" value={formatRelative(detail.lastCheckAt)} icon={<Clock size={14} className="text-gray-400" />} />
                  <StatCard label="Last Up" value={formatRelative(detail.lastUpAt)} />
                  <StatCard label="Last Down" value={formatRelative(detail.lastDownAt)} />
                </div>

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Settings</label>
                    <button
                      onClick={() => setEditing(e => !e)}
                      className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Pencil size={11} /> {editing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  {editing ? (
                    <div className="flex flex-col gap-3">
                      <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input value={draftUrl} onChange={e => setDraftUrl(e.target.value)} placeholder="https://client-site.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input value={draftEmails} onChange={e => setDraftEmails(e.target.value)} placeholder="alerts@company.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <button onClick={commitEdit} className="self-start px-4 py-2 rounded-xl text-white text-xs font-semibold" style={{ background: FOREST }}>Save</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-sm text-gray-700">
                      <div><span className="text-xs text-gray-500">Alerts:</span> {(detail.alertEmails ?? []).join(', ') || '—'}</div>
                      <div><span className="text-xs text-gray-500">Interval:</span> every {detail.checkIntervalMinutes} min</div>
                    </div>
                  )}
                </section>

                <section>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Checks</label>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      <div className="col-span-4">Time</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2">Code</div>
                      <div className="col-span-2">Time</div>
                      <div className="col-span-2">Error</div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {detail.recentChecks.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">No checks yet</div>
                      ) : (
                        detail.recentChecks.map(c => (
                          <div key={c.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-700 bg-white">
                            <div className="col-span-4 text-gray-500">{new Date(c.checkedAt).toLocaleString()}</div>
                            <div className="col-span-2">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {c.up ? 'up' : 'down'}
                              </span>
                            </div>
                            <div className="col-span-2">{c.statusCode ?? '—'}</div>
                            <div className="col-span-2">{formatResponse(c.responseTimeMs)}</div>
                            <div className="col-span-2 truncate text-red-600" title={c.errorMessage ?? ''}>{c.errorMessage ?? ''}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <WordPressTab
                  siteId={detail.id}
                  wpData={wpData}
                  wpLoading={wpLoading}
                  wpChecking={wpChecking}
                  onRunCheck={runWPCheck}
                  onCredentialsSaved={() => loadWPData(detail.id)}
                />
              </div>
            )}

            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={onRunCheck}
                disabled={checking}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: FOREST }}
              >
                <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking…' : 'Run Check'}
              </button>
              <button
                onClick={onTogglePause}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
              >
                {detail.status === 'paused' ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
                title="Delete monitor"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── WordPress Tab ────────────────────────────────────────────────────────────

function WPCredentialsForm({
  siteId,
  hasCredentials,
  onSaved,
}: {
  siteId: string
  hasCredentials: boolean
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!username.trim() || !appPassword.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/monitored-sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpUsername: username.trim(), wpAppPassword: appPassword.trim() }),
      })
      if (!res.ok) {
        toast('Failed to save credentials', 'error')
        return
      }
      toast('WordPress credentials saved', 'success')
      setUsername('')
      setAppPassword('')
      setEditing(false)
      onSaved()
    } catch {
      toast('Failed to save credentials', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <Lock size={11} /> WordPress Credentials
        </label>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <Pencil size={11} /> {hasCredentials ? 'Update' : 'Add'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 mt-2">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="WordPress admin username"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={appPassword}
              onChange={e => setAppPassword(e.target.value)}
              placeholder="Application Password (xxxx xxxx xxxx xxxx)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">
            Generate one in WP Admin → Users → Profile → Application Passwords. Stored to authenticate plugin/theme scans only.
          </p>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !username.trim() || !appPassword.trim()}
              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50"
              style={{ background: FOREST }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setUsername(''); setAppPassword('') }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600 mt-1">
          {hasCredentials
            ? 'Application Password configured — plugin/theme scans are authenticated.'
            : 'Not configured — plugin/theme details are limited to what’s publicly visible.'}
        </p>
      )}
    </section>
  )
}

function WordPressTab({
  siteId,
  wpData,
  wpLoading,
  wpChecking,
  onRunCheck,
  onCredentialsSaved,
}: {
  siteId: string
  wpData: WPData | null
  wpLoading: boolean
  wpChecking: boolean
  onRunCheck: () => void
  onCredentialsSaved: () => void
}) {
  const [pluginsOpen, setPluginsOpen] = useState(true)
  const [themesOpen, setThemesOpen] = useState(false)

  if (wpLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw size={16} className="animate-spin text-gray-400" /></div>
  }

  if (!wpData?.checked) {
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center py-8">
          <Globe size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No WordPress check yet</p>
          <p className="text-xs text-gray-400 mb-4">Run a check to detect if this site is WordPress and scan for plugins, themes, and security issues.</p>
          <button
            onClick={onRunCheck}
            disabled={wpChecking}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: FOREST }}
          >
            <RefreshCw size={13} className={wpChecking ? 'animate-spin' : ''} />
            {wpChecking ? 'Checking…' : 'Run WordPress Check'}
          </button>
        </div>
        <WPCredentialsForm siteId={siteId} hasCredentials={!!wpData?.hasCredentials} onSaved={onCredentialsSaved} />
      </div>
    )
  }

  if (!wpData.isWordPress) {
    return (
      <div className="text-center py-12">
        <Globe size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">Not a WordPress site</p>
        <p className="text-xs text-gray-400 mb-4">This site doesn&apos;t appear to be running WordPress.</p>
        <button
          onClick={onRunCheck}
          disabled={wpChecking}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={11} className={wpChecking ? 'animate-spin' : ''} /> Re-check
        </button>
      </div>
    )
  }

  const updatesNeeded = wpData.plugins.filter(p => p.updateAvailable).length
  const securityScore = Object.values(wpData.securityHeaders).filter(Boolean).length
  const securityTotal = Object.keys(wpData.securityHeaders).length
  const securityIssues: string[] = []
  if (wpData.loginPageExposed) securityIssues.push('Login page exposed')
  if (wpData.xmlRpcEnabled) securityIssues.push('XML-RPC enabled')
  if (securityScore < securityTotal) securityIssues.push(`${securityTotal - securityScore} missing security headers`)

  return (
    <>
      {/* WP Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="WP Version"
          value={wpData.wpVersion ? (wpData.coreUpdateAvailable ? `${wpData.wpVersion} (update available)` : wpData.wpVersion) : 'Hidden'}
          valueClass={wpData.coreUpdateAvailable ? 'text-amber-600' : undefined}
          icon={<Globe size={14} style={{ color: wpData.coreUpdateAvailable ? '#d97706' : FOREST }} />}
        />
        <StatCard
          label="Plugin Updates"
          value={updatesNeeded > 0 ? `${updatesNeeded} needed` : 'Up to date'}
          valueClass={updatesNeeded > 0 ? 'text-amber-600' : 'text-emerald-700'}
          icon={<Puzzle size={14} className={updatesNeeded > 0 ? 'text-amber-500' : 'text-emerald-600'} />}
        />
        <StatCard
          label="Security"
          value={securityIssues.length > 0 ? `${securityIssues.length} issues` : 'Good'}
          valueClass={securityIssues.length > 0 ? 'text-amber-600' : 'text-emerald-700'}
          icon={securityIssues.length > 0 ? <ShieldAlert size={14} className="text-amber-500" /> : <Shield size={14} className="text-emerald-600" />}
        />
      </div>

      {/* Last checked */}
      {wpData.checkedAt && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock size={10} /> Last checked {formatRelative(wpData.checkedAt)}
          <button onClick={onRunCheck} disabled={wpChecking} className="ml-2 text-emerald-700 hover:text-emerald-800 font-medium">
            {wpChecking ? 'Checking…' : 'Re-check'}
          </button>
        </p>
      )}

      {/* Security Issues */}
      {securityIssues.length > 0 && (
        <section>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Security Issues</label>
          <div className="flex flex-col gap-1.5">
            {wpData.loginPageExposed && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <Lock size={13} className="text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Login page is publicly accessible</p>
                  <p className="text-[10px] text-amber-600">Consider hiding /wp-login.php or adding 2FA</p>
                </div>
              </div>
            )}
            {wpData.xmlRpcEnabled && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <ShieldAlert size={13} className="text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">XML-RPC is enabled</p>
                  <p className="text-[10px] text-amber-600">Disable to prevent brute-force and DDoS amplification attacks</p>
                </div>
              </div>
            )}
            {Object.entries(wpData.securityHeaders).map(([header, present]) => !present && (
              <div key={header} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <AlertTriangle size={13} className="text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-600">Missing header: <code className="text-[10px] bg-gray-100 px-1 rounded">{header}</code></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plugins */}
      {wpData.plugins.length > 0 && (
        <section>
          <button onClick={() => setPluginsOpen(o => !o)} className="flex items-center justify-between w-full mb-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
              Plugins ({wpData.plugins.length})
            </label>
            {pluginsOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {pluginsOpen && (
            <div className="flex flex-col gap-1">
              {wpData.plugins.map(p => (
                <div key={p.slug} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <Puzzle size={13} className={p.status === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-400">v{p.version} · {p.status}</p>
                    </div>
                  </div>
                  {p.updateAvailable && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                      Update → {p.newVersion}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Themes */}
      {wpData.themes.length > 0 && (
        <section>
          <button onClick={() => setThemesOpen(o => !o)} className="flex items-center justify-between w-full mb-2">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">
              Themes ({wpData.themes.length})
            </label>
            {themesOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {themesOpen && (
            <div className="flex flex-col gap-1">
              {wpData.themes.map(t => (
                <div key={t.slug} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Palette size={13} className={t.active ? 'text-emerald-600' : 'text-gray-400'} />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{t.name}</p>
                      <p className="text-[10px] text-gray-400">v{t.version} · {t.active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No plugins/themes (unauthenticated) */}
      {wpData.plugins.length === 0 && wpData.themes.length === 0 && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-medium text-blue-800 mb-1">Plugin & theme details require authentication</p>
          <p className="text-[11px] text-blue-600">Add WordPress Application Password credentials below to see installed plugins and themes with update status.</p>
        </div>
      )}

      <WPCredentialsForm siteId={siteId} hasCredentials={!!wpData.hasCredentials} onSaved={onCredentialsSaved} />
    </>
  )
}

function StatCard({
  label,
  value,
  valueClass,
  icon,
}: {
  label: string
  value: string
  valueClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`text-sm font-semibold ${valueClass ?? 'text-gray-900'}`}>{value}</div>
    </div>
  )
}
