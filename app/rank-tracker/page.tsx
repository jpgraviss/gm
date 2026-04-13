'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  TrendingUp, TrendingDown, Minus, X, Trash2, Search, RefreshCw,
  Target, ArrowRight,
} from 'lucide-react'

interface TrackedKeyword {
  id: string
  workspaceId: string
  companyId: string | null
  companyName: string
  siteUrl: string
  keyword: string
  country: string
  currentPosition: number | null
  previousPosition: number | null
  bestPosition: number | null
  lastCheckedAt: string | null
  createdAt: string
}

interface RankHistoryPoint {
  id: string
  trackedKeywordId: string
  position: number | null
  checkedAt: string
}

function fmtPos(pos: number | null | undefined): string {
  if (pos == null) return '—'
  return pos.toFixed(1)
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ChangeBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
        <Minus size={11} /> —
      </span>
    )
  }
  // Lower position = better rank, so previous - current > 0 means improved.
  const delta = previous - current
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
        <Minus size={11} /> 0
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
        <TrendingUp size={11} /> +{delta.toFixed(1)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
      <TrendingDown size={11} /> {delta.toFixed(1)}
    </span>
  )
}

export default function RankTrackerPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<TrackedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [companyFilter, setCompanyFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<TrackedKeyword | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/tracked-keywords')
      if (!res.ok) {
        toast('Failed to load keywords', 'error')
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) setRows(data)
    } catch {
      toast('Failed to load keywords', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const companyOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => set.add(r.companyName))
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    if (!companyFilter.trim()) return rows
    const q = companyFilter.trim().toLowerCase()
    return rows.filter(r => r.companyName.toLowerCase().includes(q))
  }, [rows, companyFilter])

  async function deleteKeyword(id: string) {
    if (!confirm('Delete this keyword and its history?')) return
    try {
      const res = await fetch(`/api/tracked-keywords/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('Failed to delete', 'error')
        return
      }
      setRows(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) setSelected(null)
      toast('Keyword deleted', 'success')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  async function refreshAll() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/tracked-keywords/check', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body?.error || 'Refresh failed', 'error')
        return
      }
      toast('Rank check queued', 'success')
      await load()
    } catch {
      toast('Refresh failed', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <>
      <Header
        title="Rank Tracker"
        subtitle="Track keyword positions from Google Search Console"
        action={{ label: 'Add Keyword', onClick: () => setShowAdd(true) }}
      />
      <div className="page-content">
        {/* Filter + refresh */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1">
            <Search size={13} className="text-gray-400" />
            <input
              list="rank-company-options"
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              placeholder="Filter by company…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
            <datalist id="rank-company-options">
              {companyOptions.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {companyFilter && (
              <button onClick={() => setCompanyFilter('')} className="p-1 rounded hover:bg-gray-100">
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh all'}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Target size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No tracked keywords yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Add a keyword to start tracking its position in Google.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              Add Keyword
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Keyword</th>
                    <th className="text-left px-4 py-3">Site</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-right px-4 py-3">Current</th>
                    <th className="text-right px-4 py-3">Change</th>
                    <th className="text-right px-4 py-3">Best</th>
                    <th className="text-right px-4 py-3">Last Checked</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="hover:bg-emerald-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[240px]">{r.keyword}</p>
                        <p className="text-[10px] text-gray-400">{r.country}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[220px]">{r.siteUrl}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.companyName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtPos(r.currentPosition)}</td>
                      <td className="px-4 py-3 text-right">
                        <ChangeBadge current={r.currentPosition} previous={r.previousPosition} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtPos(r.bestPosition)}</td>
                      <td className="px-4 py-3 text-right text-[11px] text-gray-500">{fmtDate(r.lastCheckedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteKeyword(r.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddKeywordModal
          onClose={() => setShowAdd(false)}
          onCreated={(kw) => {
            setRows(prev => [kw, ...prev])
            setShowAdd(false)
            toast('Keyword added', 'success')
          }}
        />
      )}

      {selected && (
        <HistoryDrawer tracked={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

function AddKeywordModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (kw: TrackedKeyword) => void
}) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [country, setCountry] = useState('US')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!companyName.trim() || !siteUrl.trim() || !keyword.trim()) {
      toast('Company, site, and keyword are required', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/tracked-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          siteUrl:     siteUrl.trim(),
          keyword:     keyword.trim(),
          country:     country.trim() || 'US',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body?.error || 'Failed to add', 'error')
        return
      }
      const created = await res.json() as TrackedKeyword
      onCreated(created)
    } catch {
      toast('Failed to add', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">Add Keyword</h2>
            <p className="text-white/60 text-xs">Track a new search term</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company</label>
            <input
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Site URL (GSC property)</label>
            <input
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://example.com/ or sc-domain:example.com"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Keyword</label>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="best pizza brooklyn"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Country (ISO)</label>
            <input
              value={country}
              onChange={e => setCountry(e.target.value.toUpperCase())}
              placeholder="US"
              maxLength={3}
              className="w-24 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            {saving ? 'Adding…' : 'Add Keyword'}
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

function HistoryDrawer({
  tracked,
  onClose,
}: {
  tracked: TrackedKeyword
  onClose: () => void
}) {
  const [points, setPoints] = useState<RankHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tracked-keywords/${tracked.id}/history?days=90`)
      .then(r => r.ok ? r.json() : { points: [] })
      .then(data => {
        if (cancelled) return
        if (Array.isArray(data?.points)) setPoints(data.points)
      })
      .catch(() => { if (!cancelled) setPoints([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tracked.id])

  // Reverse so newest appears first.
  const ordered = [...points].reverse()

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(560px,100vw)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">{tracked.keyword}</h2>
            <p className="text-white/60 text-xs truncate">
              {tracked.companyName} · {tracked.siteUrl}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="p-5 border-b border-gray-100 grid grid-cols-3 gap-3">
          <Stat label="Current" value={fmtPos(tracked.currentPosition)} />
          <Stat
            label="Previous"
            value={fmtPos(tracked.previousPosition)}
            extra={
              tracked.previousPosition != null && tracked.currentPosition != null ? (
                <span className="flex items-center justify-center gap-1 text-[10px] text-gray-400 mt-0.5">
                  <ArrowRight size={10} />
                  {fmtPos(tracked.currentPosition)}
                </span>
              ) : null
            }
          />
          <Stat label="Best" value={fmtPos(tracked.bestPosition)} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            </div>
          ) : ordered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No history yet</p>
              <p className="text-xs text-gray-400 mt-1">Rankings will show up after the next check.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2">Date</th>
                  <th className="text-right px-5 py-2">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ordered.map(p => (
                  <tr key={p.id}>
                    <td className="px-5 py-2 text-xs text-gray-600">{fmtDate(p.checkedAt)}</td>
                    <td className="px-5 py-2 text-right font-semibold text-gray-900">{fmtPos(p.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  extra,
}: {
  label: string
  value: string
  extra?: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {extra}
    </div>
  )
}
