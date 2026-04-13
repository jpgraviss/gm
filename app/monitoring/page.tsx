'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Activity, X, Trash2, RefreshCw, Pause, Play, Pencil, Globe, AlertCircle,
  CheckCircle2, Clock,
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<MonitoredSite[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SiteDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
  }

  return (
    <>
      <Header
        title="Website Monitoring"
        subtitle="Uptime checks for client sites"
        action={{ label: 'Add Site', onClick: () => setShowAdd(true) }}
      />
      <div className="page-content">
        {sites.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Activity size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No sites monitored yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Add a site to start tracking uptime and response time.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
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
                        <p className="text-sm font-semibold text-gray-900 truncate">{site.companyName}</p>
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
    fetch('/api/crm/companies')
      .then(r => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCompanies(
            data
              .filter((c): c is { id: string; name: string } =>
                typeof c === 'object' && c !== null &&
                typeof (c as { id?: unknown }).id === 'string' &&
                typeof (c as { name?: unknown }).name === 'string'
              )
              .map(c => ({ id: c.id, name: c.name })),
          )
        }
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
              placeholder="https://example.com"
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
            style={{ background: '#015035' }}
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
  onClose,
  onRunCheck,
  onTogglePause,
  onDelete,
  onSave,
}: {
  loading: boolean
  detail: SiteDetail | null
  onClose: () => void
  onRunCheck: () => void
  onTogglePause: () => void
  onDelete: () => void
  onSave: (patch: { companyName: string; url: string; alertEmails: string[] }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftEmails, setDraftEmails] = useState('')

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
    }
  }, [detail])

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
            <h2 className="text-white font-bold text-sm truncate">{detail?.companyName ?? 'Loading…'}</h2>
            <p className="text-white/60 text-xs truncate">{detail?.url}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"><X size={16} className="text-white/70" /></button>
        </div>

        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              {/* Status row */}
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Status"
                  value={colors?.label ?? '—'}
                  valueClass={colors?.text ?? 'text-gray-700'}
                  icon={detail.status === 'up'
                    ? <CheckCircle2 size={14} className="text-emerald-600" />
                    : detail.status === 'down'
                      ? <AlertCircle size={14} className="text-red-600" />
                      : <Activity size={14} className="text-amber-600" />}
                />
                <Stat label="30d Uptime" value={formatUptime(detail.uptime30d)} />
                <Stat label="Response" value={formatResponse(detail.responseTimeMs)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Last Check" value={formatRelative(detail.lastCheckAt)} icon={<Clock size={14} className="text-gray-400" />} />
                <Stat label="Last Up" value={formatRelative(detail.lastUpAt)} />
                <Stat label="Last Down" value={formatRelative(detail.lastDownAt)} />
              </div>

              {/* Edit section */}
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
                    <input
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      placeholder="Company name"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      value={draftEmails}
                      onChange={e => setDraftEmails(e.target.value)}
                      placeholder="alerts@company.com"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={commitEdit}
                      className="self-start px-4 py-2 rounded-xl text-white text-xs font-semibold"
                      style={{ background: '#015035' }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 text-sm text-gray-700">
                    <div><span className="text-xs text-gray-500">Alerts:</span> {(detail.alertEmails ?? []).join(', ') || '—'}</div>
                    <div><span className="text-xs text-gray-500">Interval:</span> every {detail.checkIntervalMinutes} min</div>
                  </div>
                )}
              </section>

              {/* Recent checks */}
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

            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={onRunCheck}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-1.5"
                style={{ background: '#015035' }}
              >
                <RefreshCw size={13} /> Run Check
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

function Stat({
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
