'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  ShieldCheck, Clock, Download, Search, ChevronLeft, ChevronRight,
  Filter,
} from 'lucide-react'

interface AuditEntry {
  id: string
  user: string
  action: string
  module: string
  type: string
  metadata?: Record<string, unknown>
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600',
  action: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
}

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalFetched, setTotalFetched] = useState(0)

  const [filterUser, setFilterUser] = useState('')
  const [filterModule, setFilterModule] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchText, setSearchText] = useState('')

  const [allUsers, setAllUsers] = useState<string[]>([])
  const [allModules, setAllModules] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      // A cheap first-page probe so a genuine fetch/auth failure is
      // distinguishable from "the log is really empty" — fetchAllPages()
      // itself just returns whatever it accumulated before a failed
      // request and doesn't surface that a page errored.
      const probe = await fetch('/api/audit-logs?limit=1')
      if (!probe.ok) throw new Error('Failed')

      const data = await fetchAllPages<AuditEntry>('/api/audit-logs')
      setEntries(data)
      setTotalFetched(data.length)

      const users = [...new Set(data.map(e => e.user).filter(Boolean))]
      const modules = [...new Set(data.map(e => e.module).filter(Boolean))]
      setAllUsers(users)
      setAllModules(modules)
    } catch {
      setEntries([])
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filtered = entries.filter(e => {
    if (filterUser && e.user !== filterUser) return false
    if (filterModule && e.module !== filterModule) return false
    if (filterType && e.type !== filterType) return false
    if (filterDateFrom && e.createdAt && e.createdAt < filterDateFrom) return false
    if (filterDateTo && e.createdAt && e.createdAt > filterDateTo + 'T23:59:59Z') return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const inAction = e.action?.toLowerCase().includes(q)
      const inMeta = e.metadata ? JSON.stringify(e.metadata).toLowerCase().includes(q) : false
      if (!inAction && !inMeta) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [filterUser, filterModule, filterType, filterDateFrom, filterDateTo, searchText])

  function exportCSV() {
    const header = 'Timestamp,User,Action,Module,Type,Details'
    const rows = filtered.map(e => {
      const ts = e.createdAt ? new Date(e.createdAt).toISOString() : ''
      const details = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : ''
      return `"${ts}","${e.user ?? ''}","${(e.action ?? '').replace(/"/g, '""')}","${e.module ?? ''}","${e.type ?? ''}","${details}"`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <ShieldCheck size={40} className="text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-700 mb-1">Access Denied</h2>
          <p className="text-gray-500 text-sm mb-4">You need Super Admin privileges to access this page.</p>
          <button onClick={() => router.push('/')} className="px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: '#015035' }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Header title="Audit Log" subtitle={`${totalFetched.toLocaleString()} entries`} />
      <div className="p-4 md:p-6 flex-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 sm:flex-initial sm:w-64">
                <Search size={13} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Search actions..."
                  className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
                />
              </div>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                  showFilters ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Filter size={12} /> Filters
              </button>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Download size={12} /> Export CSV
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">User</label>
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                >
                  <option value="">All Users</option>
                  {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Module</label>
                <select
                  value={filterModule}
                  onChange={e => setFilterModule(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                >
                  <option value="">All Modules</option>
                  {allModules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                >
                  <option value="">All Types</option>
                  <option value="info">Info</option>
                  <option value="action">Action</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
                />
              </div>
              {(filterUser || filterModule || filterType || filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterUser(''); setFilterModule(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo('') }}
                  className="text-xs text-red-500 hover:text-red-600 font-medium mt-4"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-2.5 px-5 font-semibold">Timestamp</th>
                  <th className="text-left py-2.5 px-4 font-semibold">User</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Action</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Module</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Type</th>
                  <th className="text-left py-2.5 px-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-gray-400">Loading...</td>
                  </tr>
                ) : loadFailed ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-red-500">
                      Failed to load the audit log — this is an error, not an empty log.{' '}
                      <button onClick={fetchLogs} className="underline font-medium">Retry</button>
                    </td>
                  </tr>
                ) : paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-gray-400">No audit entries found</td>
                  </tr>
                ) : paged.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={11} />
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-800">{entry.user}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-700">{entry.action}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="status-badge bg-gray-100 text-gray-600">{entry.module}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`status-badge ${TYPE_COLORS[entry.type] ?? 'bg-gray-100 text-gray-600'}`}>{entry.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <span className="text-xs text-gray-400 truncate block max-w-[200px]" title={JSON.stringify(entry.metadata)}>
                          {JSON.stringify(entry.metadata).slice(0, 80)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Showing {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} className="text-gray-500" />
                </button>
                <span className="text-xs text-gray-500 px-2">Page {page + 1} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
