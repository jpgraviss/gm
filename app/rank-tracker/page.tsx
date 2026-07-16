'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  TrendingUp, TrendingDown, Minus, X, Trash2, Search, RefreshCw,
  Target, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Download,
  Upload, Plus, Tag, Filter, BarChart3, Globe, MapPin,
  Calendar, Users, FileText, Mail, Eye, ArrowRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  tags: string[]
  targetUrl: string | null
  searchEngine: string
  location: string | null
  searchVolume: number | null
}

interface RankHistoryPoint {
  id: string
  trackedKeywordId: string
  position: number | null
  checkedAt: string
}

interface Competitor {
  id: string
  domain: string
  label: string | null
  createdAt: string
}

type SortField = 'keyword' | 'currentPosition' | 'change' | 'bestPosition' | 'searchVolume' | 'companyName'
type SortDir = 'asc' | 'desc'
type TabId = 'keywords' | 'competitors' | 'reports'
type DateRange = '7' | '30' | '90' | '180' | '365'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function getDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null
  return previous - current
}

function visibilityScore(rows: TrackedKeyword[]): number {
  let score = 0
  for (const r of rows) {
    if (r.currentPosition == null) continue
    const p = r.currentPosition
    if (p <= 1) score += 100
    else if (p <= 3) score += 80
    else if (p <= 5) score += 60
    else if (p <= 10) score += 40
    else if (p <= 20) score += 20
    else if (p <= 50) score += 5
  }
  return rows.length > 0 ? Math.round(score / rows.length) : 0
}

function positionBucket(pos: number | null): string {
  if (pos == null) return 'none'
  if (pos <= 3) return '1-3'
  if (pos <= 10) return '4-10'
  if (pos <= 20) return '11-20'
  if (pos <= 50) return '21-50'
  return '50+'
}

const BUCKET_COLORS: Record<string, string> = {
  '1-3':  '#015035',
  '4-10': '#02794f',
  '11-20': '#059669',
  '21-50': '#6ee7b7',
  '50+':  '#d1d5db',
}

const BUCKET_LABELS = ['1-3', '4-10', '11-20', '21-50', '50+'] as const

const TAG_PRESETS = ['branded', 'non-branded', 'long-tail', 'local', 'commercial', 'informational']

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RankTrackerPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<TrackedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('keywords')

  // Filters
  const [searchQ, setSearchQ] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [posFilter, setPosFilter] = useState<'' | 'top3' | 'top10' | 'top20' | 'top50' | '50+'>('')
  const [changeFilter, setChangeFilter] = useState<'' | 'up' | 'down' | 'new'>('')
  const [companyFilter, setCompanyFilter] = useState('')

  // Sort
  const [sortField, setSortField] = useState<SortField>('keyword')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Modals/drawers
  const [showAdd, setShowAdd] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selected, setSelected] = useState<TrackedKeyword | null>(null)
  const [compareTarget, setCompareTarget] = useState<TrackedKeyword | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkTag, setShowBulkTag] = useState(false)

  // Competitors
  const [competitors, setCompetitors] = useState<Competitor[]>([])

  // GSC sync
  const [gscSyncing, setGscSyncing] = useState(false)
  const [gscLastSync, setGscLastSync] = useState<string | null>(null)
  const [showGscSync, setShowGscSync] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.gsc_last_sync) setGscLastSync(d.gsc_last_sync) })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      // /api/rank-tracker/keywords is cursor-paginated (100/page) — an
      // agency tracking keywords across many clients over years easily
      // exceeds that in one page, so this must follow X-Next-Cursor to
      // completion instead of a raw fetch() showing only the newest page.
      setRows(await fetchAllPages<TrackedKeyword>('/api/rank-tracker/keywords'))
    } catch {
      toast('Failed to load keywords', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadCompetitors = useCallback(async () => {
    try {
      const res = await fetch('/api/rank-tracker/competitors')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setCompetitors(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load(); loadCompetitors() }, [load, loadCompetitors])

  // Derived data
  const allTags = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => r.tags.forEach(t => s.add(t)))
    return Array.from(s).sort()
  }, [rows])

  const companyOptions = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => s.add(r.companyName))
    return Array.from(s).sort()
  }, [rows])

  const filtered = useMemo(() => {
    let f = rows
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase()
      f = f.filter(r => r.keyword.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q) || (r.targetUrl ?? '').toLowerCase().includes(q))
    }
    if (companyFilter) f = f.filter(r => r.companyName === companyFilter)
    if (tagFilter) f = f.filter(r => r.tags.includes(tagFilter))
    if (posFilter) {
      f = f.filter(r => {
        if (r.currentPosition == null) return false
        switch (posFilter) {
          case 'top3': return r.currentPosition <= 3
          case 'top10': return r.currentPosition <= 10
          case 'top20': return r.currentPosition <= 20
          case 'top50': return r.currentPosition <= 50
          case '50+': return r.currentPosition > 50
        }
      })
    }
    if (changeFilter) {
      f = f.filter(r => {
        if (changeFilter === 'new') return r.previousPosition == null && r.currentPosition != null
        const d = getDelta(r.currentPosition, r.previousPosition)
        if (d == null) return false
        return changeFilter === 'up' ? d > 0 : d < 0
      })
    }
    return f
  }, [rows, searchQ, companyFilter, tagFilter, posFilter, changeFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'keyword': cmp = a.keyword.localeCompare(b.keyword); break
        case 'currentPosition': cmp = (a.currentPosition ?? 999) - (b.currentPosition ?? 999); break
        case 'change': cmp = (getDelta(a.currentPosition, a.previousPosition) ?? 0) - (getDelta(b.currentPosition, b.previousPosition) ?? 0); break
        case 'bestPosition': cmp = (a.bestPosition ?? 999) - (b.bestPosition ?? 999); break
        case 'searchVolume': cmp = (a.searchVolume ?? 0) - (b.searchVolume ?? 0); break
        case 'companyName': cmp = a.companyName.localeCompare(b.companyName); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return arr
  }, [filtered, sortField, sortDir])

  // KPIs
  const totalKeywords = rows.length
  const withPosition = rows.filter(r => r.currentPosition != null)
  const avgPosition = withPosition.length > 0 ? withPosition.reduce((s, r) => s + (r.currentPosition ?? 0), 0) / withPosition.length : 0
  const top10Count = rows.filter(r => r.currentPosition != null && r.currentPosition <= 10).length
  const moversUp = rows.filter(r => { const d = getDelta(r.currentPosition, r.previousPosition); return d != null && d > 0 }).length
  const moversDown = rows.filter(r => { const d = getDelta(r.currentPosition, r.previousPosition); return d != null && d < 0 }).length
  const vis = visibilityScore(rows)

  const bucketCounts = useMemo(() => {
    const c: Record<string, number> = { '1-3': 0, '4-10': 0, '11-20': 0, '21-50': 0, '50+': 0 }
    rows.forEach(r => {
      const b = positionBucket(r.currentPosition)
      if (b !== 'none') c[b] = (c[b] ?? 0) + 1
    })
    return c
  }, [rows])
  const maxBucket = Math.max(1, ...Object.values(bucketCounts))

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(sorted.map(r => r.id)))
  }

  async function deleteKeyword(id: string) {
    if (!confirm('Delete this keyword and its history?')) return
    try {
      const res = await fetch(`/api/rank-tracker/keywords/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete', 'error'); return }
      setRows(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) setSelected(null)
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      toast('Keyword deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} keywords and their history?`)) return
    const ids = Array.from(selectedIds)
    let ok = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/rank-tracker/keywords/${id}`, { method: 'DELETE' })
        if (res.ok) ok++
      } catch { /* skip */ }
    }
    setRows(prev => prev.filter(r => !selectedIds.has(r.id)))
    setSelectedIds(new Set())
    toast(`Deleted ${ok} keywords`, 'success')
  }

  async function bulkTagApply(tag: string) {
    const ids = Array.from(selectedIds)
    let ok = 0
    for (const id of ids) {
      const kw = rows.find(r => r.id === id)
      if (!kw) continue
      const newTags = kw.tags.includes(tag) ? kw.tags : [...kw.tags, tag]
      try {
        const res = await fetch(`/api/rank-tracker/keywords/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newTags }),
        })
        if (res.ok) {
          ok++
          setRows(prev => prev.map(r => r.id === id ? { ...r, tags: newTags } : r))
        }
      } catch { /* skip */ }
    }
    setShowBulkTag(false)
    setSelectedIds(new Set())
    toast(`Tagged ${ok} keywords with "${tag}"`, 'success')
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
    } catch { toast('Refresh failed', 'error') }
    finally { setRefreshing(false) }
  }

  async function exportCSV() {
    try {
      const params = new URLSearchParams()
      if (companyFilter) params.set('company', companyFilter)
      if (tagFilter) params.set('tag', tagFilter)
      const res = await fetch(`/api/rank-tracker/export?${params}`)
      if (!res.ok) { toast('Export failed', 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rank-tracker-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast('Exported CSV', 'success')
    } catch { toast('Export failed', 'error') }
  }

  if (loading) return <LoadingScreen />

  return (
    <>
      <Header
        title="Rank Tracker"
        subtitle="Track keyword positions across search engines"
        action={{ label: 'Add Keywords', onClick: () => setShowBulkAdd(true) }}
      />
      <div className="page-content">
        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Total Keywords" value={String(totalKeywords)} icon={<Target size={15} />} />
          <KpiCard label="Avg Position" value={avgPosition > 0 ? avgPosition.toFixed(1) : '—'} icon={<BarChart3 size={15} />} />
          <KpiCard label="Top 10" value={String(top10Count)} icon={<TrendingUp size={15} />} accent />
          <KpiCard label="Moved Up" value={String(moversUp)} icon={<ArrowUp size={15} />} color="text-emerald-600" />
          <KpiCard label="Moved Down" value={String(moversDown)} icon={<ArrowDown size={15} />} color="text-red-500" />
          <KpiCard label="Visibility" value={`${vis}%`} icon={<Eye size={15} />} accent />
        </div>

        {/* ── Position Distribution ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Position Distribution</h3>
          <div className="flex items-end gap-2 h-24">
            {BUCKET_LABELS.map(label => {
              const count = bucketCounts[label] ?? 0
              const pct = (count / maxBucket) * 100
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">{count}</span>
                  <div className="w-full rounded-t-md" style={{ height: `${Math.max(pct, 4)}%`, background: BUCKET_COLORS[label] }} />
                  <span className="text-[10px] text-gray-500 font-medium">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4 border-b border-gray-100 pb-px">
          {([['keywords', 'Keywords'], ['competitors', 'Competitors'], ['reports', 'Reports']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === id ? 'bg-white border border-b-0 border-gray-200 text-[#015035]' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Keywords Tab ─────────────────────────────────────────────── */}
        {activeTab === 'keywords' && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-2 mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1">
                <Search size={13} className="text-gray-400" />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search keywords, companies, URLs..."
                  className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
                {searchQ && (
                  <button onClick={() => setSearchQ('')} className="p-1 rounded hover:bg-gray-100">
                    <X size={12} className="text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterSelect value={companyFilter} onChange={setCompanyFilter} placeholder="Company" options={companyOptions} icon={<Users size={12} />} />
                <FilterSelect value={tagFilter} onChange={setTagFilter} placeholder="Tag" options={allTags} icon={<Tag size={12} />} />
                <FilterSelect
                  value={posFilter}
                  onChange={v => setPosFilter(v as typeof posFilter)}
                  placeholder="Position"
                  options={['top3', 'top10', 'top20', 'top50', '50+']}
                  labels={['Top 3', 'Top 10', 'Top 20', 'Top 50', '50+']}
                  icon={<Filter size={12} />}
                />
                <FilterSelect
                  value={changeFilter}
                  onChange={v => setChangeFilter(v as typeof changeFilter)}
                  placeholder="Change"
                  options={['up', 'down', 'new']}
                  labels={['Moved Up', 'Moved Down', 'New']}
                  icon={<TrendingUp size={12} />}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAdd(true)} className="px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90" style={{ background: '#015035' }}>
                  <Plus size={13} className="inline -mt-0.5 mr-1" />Single
                </button>
                <button onClick={() => setShowBulkAdd(true)} className="px-3 py-2 rounded-xl border border-[#015035] text-[#015035] text-xs font-semibold hover:bg-emerald-50">
                  <Plus size={13} className="inline -mt-0.5 mr-1" />Bulk
                </button>
                <button onClick={() => setShowImport(true)} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                  <Upload size={13} className="inline -mt-0.5 mr-1" />CSV
                </button>
                <button onClick={exportCSV} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                  <Download size={13} className="inline -mt-0.5 mr-1" />Export
                </button>
                <button onClick={refreshAll} disabled={refreshing} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
                  <RefreshCw size={13} className={`inline -mt-0.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Checking...' : 'Refresh'}
                </button>
                <button onClick={() => setShowGscSync(true)} disabled={gscSyncing} className="px-3 py-2 rounded-xl border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50 disabled:opacity-50">
                  <Globe size={13} className="inline -mt-0.5 mr-1" />
                  {gscSyncing ? 'Syncing...' : 'Sync from GSC'}
                </button>
              </div>
              {gscLastSync && (
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  Last GSC sync: {new Date(gscLastSync).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 bg-[#015035]/5 border border-[#015035]/20 rounded-xl px-4 py-2.5 mb-3">
                <span className="text-sm font-medium text-[#015035]">{selectedIds.size} selected</span>
                <button onClick={() => setShowBulkTag(true)} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Tag size={11} className="inline -mt-0.5 mr-1" />Tag
                </button>
                <button onClick={bulkDelete} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-600 hover:bg-red-100">
                  <Trash2 size={11} className="inline -mt-0.5 mr-1" />Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-500 hover:text-gray-700">Clear</button>
              </div>
            )}

            {sorted.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Target size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No tracked keywords yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Add keywords to start tracking positions.</p>
                <button onClick={() => setShowBulkAdd(true)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>
                  Add Keywords
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-3 w-10">
                          <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={selectAll} className="rounded border-gray-300 accent-[#015035]" />
                        </th>
                        <SortHeader label="Keyword" field="keyword" current={sortField} dir={sortDir} onSort={toggleSort} />
                        <SortHeader label="Position" field="currentPosition" current={sortField} dir={sortDir} onSort={toggleSort} align="right" />
                        <th className="text-right px-4 py-3">Previous</th>
                        <SortHeader label="Change" field="change" current={sortField} dir={sortDir} onSort={toggleSort} align="right" />
                        <SortHeader label="Best" field="bestPosition" current={sortField} dir={sortDir} onSort={toggleSort} align="right" />
                        <th className="text-left px-4 py-3">URL Ranking</th>
                        <SortHeader label="Volume" field="searchVolume" current={sortField} dir={sortDir} onSort={toggleSort} align="right" />
                        <th className="text-left px-4 py-3">Tags</th>
                        <th className="text-right px-4 py-3">Last Checked</th>
                        <th className="px-3 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map(r => (
                        <tr key={r.id} className="hover:bg-emerald-50/30 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300 accent-[#015035]" />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">{r.keyword}</p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Globe size={9} />{r.searchEngine} · {r.country}
                              {r.location && <><MapPin size={9} className="ml-1" />{r.location}</>}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <PositionBadge position={r.currentPosition} />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{fmtPos(r.previousPosition)}</td>
                          <td className="px-4 py-3 text-right">
                            <ChangeBadge current={r.currentPosition} previous={r.previousPosition} />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmtPos(r.bestPosition)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[180px]">{r.targetUrl ?? r.siteUrl}</td>
                          <td className="px-4 py-3 text-right text-gray-600 text-xs">{r.searchVolume != null ? r.searchVolume.toLocaleString() : '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {r.tags.map(t => (
                                <span key={t} className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-medium text-emerald-700">{t}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-gray-500">{fmtDate(r.lastCheckedAt)}</td>
                          <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <button onClick={() => deleteKeyword(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                  Showing {sorted.length} of {rows.length} keywords
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Competitors Tab ──────────────────────────────────────────── */}
        {activeTab === 'competitors' && (
          <CompetitorsTab
            competitors={competitors}
            keywords={rows}
            onUpdate={loadCompetitors}
          />
        )}

        {/* ── Reports Tab ──────────────────────────────────────────────── */}
        {activeTab === 'reports' && <ReportsTab />}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddKeywordModal
          onClose={() => setShowAdd(false)}
          onCreated={(kw) => { setRows(prev => [kw, ...prev]); setShowAdd(false); toast('Keyword added', 'success') }}
        />
      )}
      {showBulkAdd && (
        <BulkAddModal
          onClose={() => setShowBulkAdd(false)}
          onCreated={(kws) => { setRows(prev => [...kws, ...prev]); setShowBulkAdd(false); toast(`Added ${kws.length} keywords`, 'success') }}
        />
      )}
      {showImport && (
        <ImportCSVModal
          onClose={() => setShowImport(false)}
          onImported={(kws) => { setRows(prev => [...kws, ...prev]); setShowImport(false); toast(`Imported ${kws.length} keywords`, 'success') }}
        />
      )}
      {selected && (
        <HistoryDrawer
          tracked={selected}
          allKeywords={rows}
          compareTarget={compareTarget}
          onCompare={setCompareTarget}
          onClose={() => { setSelected(null); setCompareTarget(null) }}
        />
      )}
      {showBulkTag && (
        <BulkTagModal
          allTags={allTags}
          onApply={bulkTagApply}
          onClose={() => setShowBulkTag(false)}
        />
      )}
      {showGscSync && (
        <GscSyncModal
          onClose={() => setShowGscSync(false)}
          onSynced={(count) => {
            setShowGscSync(false)
            setGscLastSync(new Date().toISOString())
            toast(`Synced ${count} keywords from GSC`, 'success')
            load()
          }}
          syncing={gscSyncing}
          setSyncing={setGscSyncing}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ label, value, icon, accent, color }: {
  label: string; value: string; icon: React.ReactNode; accent?: boolean; color?: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'bg-[#015035] border-[#015035]' : 'bg-white border-gray-100'}`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${accent ? 'text-white/70' : 'text-gray-400'}`}>
        {icon}{label}
      </div>
      <p className={`text-xl font-bold mt-1 ${accent ? 'text-white' : color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Position badge
// ---------------------------------------------------------------------------

function PositionBadge({ position }: { position: number | null }) {
  if (position == null) return <span className="text-gray-400">{'—'}</span>
  let bg = 'bg-gray-100 text-gray-700'
  if (position <= 3) bg = 'bg-[#015035] text-white'
  else if (position <= 10) bg = 'bg-emerald-100 text-emerald-800'
  else if (position <= 20) bg = 'bg-yellow-100 text-yellow-800'
  else if (position <= 50) bg = 'bg-orange-100 text-orange-800'
  else bg = 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${bg}`}>{position.toFixed(1)}</span>
}

// ---------------------------------------------------------------------------
// Change badge
// ---------------------------------------------------------------------------

function ChangeBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400"><Minus size={11} /> {'—'}</span>
  }
  const delta = previous - current
  if (Math.abs(delta) < 0.05) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400"><Minus size={11} /> 0</span>
  }
  if (delta > 0) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><TrendingUp size={11} /> +{delta.toFixed(1)}</span>
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"><TrendingDown size={11} /> {delta.toFixed(1)}</span>
}

// ---------------------------------------------------------------------------
// Sort header
// ---------------------------------------------------------------------------

function SortHeader({ label, field, current, dir, onSort, align }: {
  label: string; field: SortField; current: SortField; dir: SortDir; onSort: (f: SortField) => void; align?: 'right'
}) {
  const active = current === field
  return (
    <th className={`${align === 'right' ? 'text-right' : 'text-left'} px-4 py-3 cursor-pointer select-none hover:text-gray-700`} onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// Filter select
// ---------------------------------------------------------------------------

function FilterSelect({ value, onChange, placeholder, options, labels, icon }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; labels?: string[]; icon?: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-7 pr-7 py-2 text-xs text-gray-700 font-medium cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#015035]/20"
      >
        <option value="">{placeholder}</option>
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o}</option>)}
      </select>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</span>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Keyword Modal (single)
// ---------------------------------------------------------------------------

function AddKeywordModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (kw: TrackedKeyword) => void
}) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [country, setCountry] = useState('US')
  const [targetUrl, setTargetUrl] = useState('')
  const [searchEngine, setSearchEngine] = useState('google')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addTag(t: string) {
    const tag = t.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
  }

  async function submit() {
    if (!companyName.trim() || !siteUrl.trim() || !keyword.trim()) {
      toast('Company, site, and keyword are required', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rank-tracker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(), siteUrl: siteUrl.trim(), keyword: keyword.trim(),
          country: country.trim() || 'US', targetUrl: targetUrl.trim() || undefined,
          searchEngine, location: location.trim() || undefined, tags,
        }),
      })
      if (!res.ok) { const body = await res.json().catch(() => ({})); toast(body?.error || 'Failed to add', 'error'); return }
      const created = await res.json() as TrackedKeyword
      onCreated(created)
    } catch { toast('Failed to add', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">Add Keyword</h2>
            <p className="text-white/60 text-xs">Track a new search term</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <Field label="Company"><input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
          <Field label="Site URL (GSC property)"><input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://site.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" /></Field>
          <Field label="Keyword"><input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="best pizza brooklyn" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
          <Field label="Target URL"><input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://site.com/pizza" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Country (ISO)"><input value={country} onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="US" maxLength={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase" /></Field>
            <Field label="Search Engine">
              <select value={searchEngine} onChange={e => setSearchEngine(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="google">Google</option>
                <option value="bing">Bing</option>
              </select>
            </Field>
            <Field label="Location"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
          </div>
          <Field label="Tags">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                  {t}<button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500"><X size={9} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }} placeholder="Add tag..." className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1" />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_PRESETS.filter(t => !tags.includes(t)).map(t => (
                <button key={t} onClick={() => addTag(t)} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 hover:bg-gray-200">{t}</button>
              ))}
            </div>
          </Field>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            {saving ? 'Adding...' : 'Add Keyword'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bulk Add Modal
// ---------------------------------------------------------------------------

function BulkAddModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (kws: TrackedKeyword[]) => void
}) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [keywordsText, setKeywordsText] = useState('')
  const [country, setCountry] = useState('US')
  const [targetUrl, setTargetUrl] = useState('')
  const [searchEngine, setSearchEngine] = useState('google')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addTag(t: string) {
    const tag = t.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
  }

  const kwCount = keywordsText.split('\n').filter(l => l.trim()).length

  async function submit() {
    const keywords = keywordsText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!companyName.trim() || !siteUrl.trim() || keywords.length === 0) {
      toast('Company, site, and at least one keyword are required', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rank-tracker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(), siteUrl: siteUrl.trim(), keywords,
          country: country.trim() || 'US', targetUrl: targetUrl.trim() || undefined,
          searchEngine, location: location.trim() || undefined, tags,
        }),
      })
      if (!res.ok) { const body = await res.json().catch(() => ({})); toast(body?.error || 'Failed to add', 'error'); return }
      const created = await res.json() as TrackedKeyword[]
      onCreated(created)
    } catch { toast('Failed to add', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">Bulk Add Keywords</h2>
            <p className="text-white/60 text-xs">One keyword per line</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
            <Field label="Site URL"><input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://site.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" /></Field>
          </div>
          <Field label={`Keywords (${kwCount})`}>
            <textarea
              value={keywordsText}
              onChange={e => setKeywordsText(e.target.value)}
              placeholder="best pizza brooklyn\npizza delivery near me\nnew york pizza restaurant"
              rows={6}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs resize-y"
            />
          </Field>
          <Field label="Target URL (optional)"><input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://site.com/page" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Country"><input value={country} onChange={e => setCountry(e.target.value.toUpperCase())} placeholder="US" maxLength={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase" /></Field>
            <Field label="Engine">
              <select value={searchEngine} onChange={e => setSearchEngine(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="google">Google</option>
                <option value="bing">Bing</option>
              </select>
            </Field>
            <Field label="Location"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="New York" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
          </div>
          <Field label="Tags">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                  {t}<button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-500"><X size={9} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }} placeholder="Add tag..." className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1" />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_PRESETS.filter(t => !tags.includes(t)).map(t => (
                <button key={t} onClick={() => addTag(t)} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 hover:bg-gray-200">{t}</button>
              ))}
            </div>
          </Field>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={submit} disabled={saving || kwCount === 0} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            {saving ? 'Adding...' : `Add ${kwCount} Keyword${kwCount !== 1 ? 's' : ''}`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import CSV Modal
// ---------------------------------------------------------------------------

function ImportCSVModal({ onClose, onImported }: {
  onClose: () => void
  onImported: (kws: TrackedKeyword[]) => void
}) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [preview, setPreview] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const keywords: string[] = []
      for (const line of lines) {
        const cols = line.split(',')
        const kw = cols[0]?.replace(/^["']|["']$/g, '').trim()
        if (kw && kw.toLowerCase() !== 'keyword') keywords.push(kw)
      }
      setPreview(keywords)
    }
    reader.readAsText(file)
  }

  async function submit() {
    if (!companyName.trim() || !siteUrl.trim() || preview.length === 0) {
      toast('Company, site, and a CSV file are required', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rank-tracker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim(), siteUrl: siteUrl.trim(), keywords: preview }),
      })
      if (!res.ok) { toast('Import failed', 'error'); return }
      const created = await res.json() as TrackedKeyword[]
      onImported(created)
    } catch { toast('Import failed', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">Import from CSV</h2>
            <p className="text-white/60 text-xs">First column should be keywords</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company"><input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" /></Field>
            <Field label="Site URL"><input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://site.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" /></Field>
          </div>
          <Field label="CSV File">
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="text-sm text-gray-600" />
          </Field>
          {preview.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 mb-1">{preview.length} keywords found:</p>
              {preview.slice(0, 20).map((kw, i) => (
                <p key={i} className="text-xs text-gray-700 truncate">{kw}</p>
              ))}
              {preview.length > 20 && <p className="text-xs text-gray-400 mt-1">...and {preview.length - 20} more</p>}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={submit} disabled={saving || preview.length === 0} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            {saving ? 'Importing...' : `Import ${preview.length} Keywords`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bulk Tag Modal
// ---------------------------------------------------------------------------

function BulkTagModal({ allTags, onApply, onClose }: {
  allTags: string[]
  onApply: (tag: string) => void
  onClose: () => void
}) {
  const [tag, setTag] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <h2 className="text-white font-bold text-sm">Apply Tag</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Tag name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex flex-wrap gap-1">
            {[...TAG_PRESETS, ...allTags.filter(t => !TAG_PRESETS.includes(t))].map(t => (
              <button key={t} onClick={() => setTag(t)} className={`px-2 py-1 rounded text-[10px] font-medium ${tag === t ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={() => { if (tag.trim()) onApply(tag.trim().toLowerCase()) }} disabled={!tag.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            Apply Tag
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GSC Sync Modal
// ---------------------------------------------------------------------------

function GscSyncModal({ onClose, onSynced, syncing, setSyncing }: {
  onClose: () => void
  onSynced: (count: number) => void
  syncing: boolean
  setSyncing: (v: boolean) => void
}) {
  const { toast } = useToast()
  const [siteUrl, setSiteUrl] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState('')

  async function handleSync() {
    if (!siteUrl.trim() || !companyName.trim()) return
    setSyncing(true)
    try {
      const res = await fetch('/api/rank-tracker/sync-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl.trim(),
          companyName: companyName.trim(),
          companyId: companyId.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body.error || 'GSC sync failed', 'error')
        return
      }
      const data = await res.json()
      onSynced(data.synced ?? 0)
    } catch {
      toast('GSC sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <h2 className="text-white font-bold text-sm">Sync from Google Search Console</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs text-gray-500">Pull top queries from GSC and sync them as tracked keywords.</p>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Site URL</label>
            <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://example.com" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Company Name</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Company ID (optional)</label>
            <input value={companyId} onChange={e => setCompanyId(e.target.value)} placeholder="Company ID" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleSync}
            disabled={!siteUrl.trim() || !companyName.trim() || syncing}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            {syncing ? 'Syncing...' : 'Sync Keywords'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History Drawer (with chart + comparison)
// ---------------------------------------------------------------------------

function HistoryDrawer({ tracked, allKeywords, compareTarget, onCompare, onClose }: {
  tracked: TrackedKeyword
  allKeywords: TrackedKeyword[]
  compareTarget: TrackedKeyword | null
  onCompare: (kw: TrackedKeyword | null) => void
  onClose: () => void
}) {
  const [points, setPoints] = useState<RankHistoryPoint[]>([])
  const [comparePoints, setComparePoints] = useState<RankHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('90')

  useEffect(() => {
    let cancelled = false
    requestAnimationFrame(() => { if (!cancelled) setLoading(true) })
    fetch(`/api/rank-tracker/keywords/${tracked.id}/history?days=${dateRange}`)
      .then(r => r.ok ? r.json() : { points: [] })
      .then(data => { if (!cancelled && Array.isArray(data?.points)) setPoints(data.points) })
      .catch(() => { if (!cancelled) setPoints([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tracked.id, dateRange])

  useEffect(() => {
    if (!compareTarget) { requestAnimationFrame(() => setComparePoints([])); return }
    let cancelled = false
    fetch(`/api/rank-tracker/keywords/${compareTarget.id}/history?days=${dateRange}`)
      .then(r => r.ok ? r.json() : { points: [] })
      .then(data => { if (!cancelled && Array.isArray(data?.points)) setComparePoints(data.points) })
      .catch(() => { if (!cancelled) setComparePoints([]) })
    return () => { cancelled = true }
  }, [compareTarget, dateRange])

  const ordered = [...points]
  const otherKeywords = allKeywords.filter(k => k.id !== tracked.id)

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(640px,100vw)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">{tracked.keyword}</h2>
            <p className="text-white/60 text-xs truncate">
              {tracked.companyName} · {tracked.siteUrl}
              {tracked.location && ` · ${tracked.location}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>

        {/* Stats */}
        <div className="p-5 border-b border-gray-100 grid grid-cols-4 gap-3">
          <StatCard label="Current" value={fmtPos(tracked.currentPosition)} />
          <StatCard label="Previous" value={fmtPos(tracked.previousPosition)} extra={
            tracked.previousPosition != null && tracked.currentPosition != null
              ? <span className="flex items-center justify-center gap-1 text-[10px] text-gray-400 mt-0.5"><ArrowRight size={10} />{fmtPos(tracked.currentPosition)}</span>
              : null
          } />
          <StatCard label="Best" value={fmtPos(tracked.bestPosition)} />
          <StatCard label="Volume" value={tracked.searchVolume != null ? tracked.searchVolume.toLocaleString() : '—'} />
        </div>

        {/* Tags */}
        {tracked.tags.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-100 flex flex-wrap gap-1">
            {tracked.tags.map(t => <span key={t} className="px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-medium text-emerald-700">{t}</span>)}
          </div>
        )}

        {/* Date range selector */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Calendar size={13} className="text-gray-400" />
          {([['7', '7d'], ['30', '30d'], ['90', '90d'], ['180', '6m'], ['365', '1y']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setDateRange(val)} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${dateRange === val ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Comparison selector */}
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-2">
          <Users size={13} className="text-gray-400" />
          <select
            value={compareTarget?.id ?? ''}
            onChange={e => {
              const kw = otherKeywords.find(k => k.id === e.target.value) ?? null
              onCompare(kw)
            }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none"
          >
            <option value="">Compare with...</option>
            {otherKeywords.map(k => <option key={k.id} value={k.id}>{k.keyword} ({k.companyName})</option>)}
          </select>
          {compareTarget && (
            <button onClick={() => onCompare(null)} className="text-xs text-red-500 hover:text-red-700">Clear</button>
          )}
        </div>

        {/* Chart */}
        <div className="px-5 py-4 border-b border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#015035]" />
            </div>
          ) : ordered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No history data for this range</p>
            </div>
          ) : (
            <CSSLineChart points={ordered} comparePoints={compareTarget ? comparePoints : []} />
          )}
        </div>

        {/* History table */}
        <div className="flex-1 overflow-y-auto">
          {ordered.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2">Date</th>
                  <th className="text-right px-5 py-2">Position</th>
                  {compareTarget && <th className="text-right px-5 py-2 text-blue-500">{compareTarget.keyword}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...ordered].reverse().map(p => {
                  const cp = comparePoints.find(c => c.checkedAt.slice(0, 10) === p.checkedAt.slice(0, 10))
                  return (
                    <tr key={p.id}>
                      <td className="px-5 py-2 text-xs text-gray-600">{fmtDate(p.checkedAt)}</td>
                      <td className="px-5 py-2 text-right font-semibold text-gray-900">{fmtPos(p.position)}</td>
                      {compareTarget && <td className="px-5 py-2 text-right font-semibold text-blue-600">{cp ? fmtPos(cp.position) : '—'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSS Line Chart
// ---------------------------------------------------------------------------

function CSSLineChart({ points, comparePoints }: { points: RankHistoryPoint[]; comparePoints: RankHistoryPoint[] }) {
  const validPoints = points.filter(p => p.position != null)
  if (validPoints.length === 0) return <p className="text-xs text-gray-400 text-center py-4">No position data to chart</p>

  const allPositions = [
    ...validPoints.map(p => p.position!),
    ...comparePoints.filter(p => p.position != null).map(p => p.position!),
  ]
  const minPos = Math.max(1, Math.floor(Math.min(...allPositions)) - 2)
  const maxPos = Math.ceil(Math.max(...allPositions)) + 2
  const range = Math.max(maxPos - minPos, 1)
  const chartH = 120

  function yForPos(pos: number): number {
    return ((pos - minPos) / range) * chartH
  }

  const mainPath = validPoints.map((p, i) => {
    const x = validPoints.length === 1 ? 50 : (i / (validPoints.length - 1)) * 100
    const y = yForPos(p.position!)
    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}`
  }).join(' ')

  const validCompare = comparePoints.filter(p => p.position != null)
  const comparePath = validCompare.length > 1 ? validCompare.map((p, i) => {
    const x = (i / (validCompare.length - 1)) * 100
    const y = yForPos(p.position!)
    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}`
  }).join(' ') : null

  return (
    <div className="relative" style={{ height: chartH }}>
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 w-6 text-right">{Math.round(minPos + frac * range)}</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>
        ))}
      </div>
      <svg className="absolute inset-0 w-full h-full" style={{ marginLeft: 32 }} viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none">
        <path d={mainPath} fill="none" stroke="#015035" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {comparePath && <path d={comparePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4,2" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute bottom-0 left-8 right-0 flex justify-between pointer-events-none">
        <span className="text-[9px] text-gray-400">{fmtDate(validPoints[0]?.checkedAt)}</span>
        <span className="text-[9px] text-gray-400">{fmtDate(validPoints[validPoints.length - 1]?.checkedAt)}</span>
      </div>
      {comparePath && (
        <div className="absolute top-1 right-1 flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#015035] inline-block" />Primary</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block border-dashed" />Compare</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitors Tab
// ---------------------------------------------------------------------------

function CompetitorsTab({ competitors, keywords, onUpdate }: {
  competitors: Competitor[]
  keywords: TrackedKeyword[]
  onUpdate: () => void
}) {
  const { toast } = useToast()
  const [domain, setDomain] = useState('')
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const [competitorSnapshots, setCompetitorSnapshots] = useState<Record<string, Record<string, number | null>>>({})

  useEffect(() => {
    if (competitors.length === 0 || keywords.length === 0) return
    fetch('/api/rank-tracker/competitor-snapshots')
      .then(r => r.ok ? r.json() : {})
      .then(data => setCompetitorSnapshots(data))
      .catch(() => {})
  }, [competitors.length, keywords.length])

  async function addComp() {
    if (!domain.trim()) { toast('Domain is required', 'error'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/rank-tracker/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), label: label.trim() || undefined }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); toast(b?.error || 'Failed to add', 'error'); return }
      setDomain(''); setLabel('')
      onUpdate()
      toast('Competitor added', 'success')
    } catch { toast('Failed to add', 'error') }
    finally { setAdding(false) }
  }

  async function removeComp(id: string) {
    if (!confirm('Remove this competitor?')) return
    try {
      const res = await fetch(`/api/rank-tracker/competitors/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to remove competitor', 'error'); return }
      onUpdate()
      toast('Competitor removed', 'success')
    } catch { toast('Failed to remove', 'error') }
  }

  const withPosition = keywords.filter(k => k.currentPosition != null)
  const totalVoice = withPosition.reduce((s, k) => s + Math.max(0, 100 - (k.currentPosition ?? 100)), 0)

  return (
    <div className="space-y-4">
      {/* Add competitor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Competitor Domain</h3>
        <div className="flex gap-2">
          <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="competitor.com" className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional)" className="w-40 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={addComp} disabled={adding} className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Share of Voice */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Share of Voice</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${totalVoice > 0 ? Math.min(100, (totalVoice / (withPosition.length * 100)) * 100) : 0}%`, background: '#015035' }} />
            </div>
          </div>
          <span className="text-sm font-bold text-[#015035]">
            {totalVoice > 0 ? Math.round((totalVoice / (withPosition.length * 100)) * 100) : 0}%
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Based on {withPosition.length} keywords with ranking data. Higher is better.</p>
      </div>

      {/* Competitor list */}
      {competitors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Globe size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No competitors added yet</p>
          <p className="text-xs text-gray-400 mt-1">Add competitor domains to compare rankings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Domain</th>
                <th className="text-left px-4 py-3">Label</th>
                <th className="text-right px-4 py-3">Added</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {competitors.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.domain}</td>
                  <td className="px-4 py-3 text-gray-600">{c.label || '—'}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => removeComp(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison table */}
      {competitors.length > 0 && keywords.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Keyword Comparison</h3>
          </div>
          {Object.keys(competitorSnapshots).length === 0 && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-700">
                No competitor rank data yet — dashes below aren&apos;t missing data, they mean
                competitor rank checking isn&apos;t connected to a live SERP data source.
                Your own keyword positions (from Google Search Console) are still accurate.
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Keyword</th>
                  <th className="text-right px-4 py-2">Your Position</th>
                  {competitors.map(c => (
                    <th key={c.id} className="text-right px-4 py-2">{c.label || c.domain}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keywords.slice(0, 50).map(kw => (
                  <tr key={kw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 truncate max-w-[200px]">{kw.keyword}</td>
                    <td className="px-4 py-2 text-right">
                      <PositionBadge position={kw.currentPosition} />
                    </td>
                    {competitors.map(c => {
                      const pos = competitorSnapshots[kw.id]?.[c.id] ?? null
                      return (
                        <td key={c.id} className="px-4 py-2 text-right">
                          {pos != null
                            ? <PositionBadge position={pos} />
                            : <span className="text-gray-400 text-xs">{'—'}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {keywords.length > 50 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Showing 50 of {keywords.length} keywords
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reports Tab
// ---------------------------------------------------------------------------

function ReportsTab() {
  const { toast } = useToast()
  const [reports, setReports] = useState<Array<{ id: string; name: string; frequency: string; recipients: string[]; lastSentAt: string | null; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetch('/api/rank-tracker/reports')
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setReports(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function deleteReport(id: string) {
    if (!confirm('Delete this scheduled report?')) return
    try {
      const res = await fetch(`/api/rank-tracker/reports/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete report', 'error'); return }
      setReports(prev => prev.filter(r => r.id !== id))
      toast('Report deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Scheduled Reports</h3>
          <p className="text-xs text-gray-500">Automated weekly email ranking reports</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ background: '#015035' }}>
          <Plus size={13} className="inline -mt-0.5 mr-1" />New Report
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#015035]" /></div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Mail size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No scheduled reports</p>
          <p className="text-xs text-gray-400 mt-1">Create a report to send weekly ranking summaries via email.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Report Name</th>
                <th className="text-left px-4 py-3">Frequency</th>
                <th className="text-left px-4 py-3">Recipients</th>
                <th className="text-right px-4 py-3">Last Sent</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2"><FileText size={13} className="text-[#015035]" />{r.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{r.frequency}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.recipients.join(', ')}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{r.lastSentAt ? fmtDate(r.lastSentAt) : 'Never'}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateReportModal
          onClose={() => setShowCreate(false)}
          onCreated={(r) => { setReports(prev => [r, ...prev]); setShowCreate(false); toast('Report created', 'success') }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Report Modal
// ---------------------------------------------------------------------------

function CreateReportModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (r: { id: string; name: string; frequency: string; recipients: string[]; lastSentAt: string | null; createdAt: string }) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [recipientText, setRecipientText] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const rawRecipients = recipientText.split(/[,\n]/).map(e => e.trim()).filter(Boolean)
    const recipients = rawRecipients.filter(e => emailRegex.test(e))
    const invalidCount = rawRecipients.length - recipients.length
    if (invalidCount > 0) {
      toast(`Removed ${invalidCount} invalid email${invalidCount > 1 ? 's' : ''}`, 'error')
    }
    if (!name.trim() || recipients.length === 0) {
      toast('Name and at least one valid recipient email are required', 'error'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/rank-tracker/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), frequency, recipients }),
      })
      if (!res.ok) { toast('Failed to create report', 'error'); return }
      const created = await res.json()
      onCreated(created)
    } catch { toast('Failed to create report', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">New Scheduled Report</h2>
            <p className="text-white/60 text-xs">Recurring ranking email</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <Field label="Report Name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Weekly Ranking Report" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </Field>
          <Field label="Frequency">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Recipients (one per line or comma-separated)">
            <textarea value={recipientText} onChange={e => setRecipientText(e.target.value)} placeholder="client@example.com&#10;team@graviss.com" rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs resize-y" />
          </Field>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50" style={{ background: '#015035' }}>
            {saving ? 'Creating...' : 'Create Report'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function StatCard({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {extra}
    </div>
  )
}
