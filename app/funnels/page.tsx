'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Plus, Trash2, ArrowRight, Eye, Target, Pencil, ChevronDown,
  ChevronUp, ExternalLink, Layers, GripVertical, FileText,
} from 'lucide-react'

interface FunnelSummary {
  id: string
  name: string
  slug: string
  status: 'Draft' | 'Published'
  pageCount: number
  views: number
  conversions: number
  conversionRate: string
  createdAt: string
}

interface FunnelPage {
  id: string
  name: string
  slug: string
  sort_order: number
  views: number
  conversions: number
  blocks: unknown[]
}

interface FunnelDetail {
  id: string
  name: string
  slug: string
  status: 'Draft' | 'Published'
  pages: FunnelPage[]
}

export default function FunnelsPage() {
  const router = useRouter()
  const { toast: addToast } = useToast()
  const [funnels, setFunnels] = useState<FunnelSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FunnelDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingPage, setAddingPage] = useState(false)
  const [newPageName, setNewPageName] = useState('')

  useEffect(() => {
    loadFunnels()
  }, [])

  async function loadFunnels() {
    try {
      const res = await fetch('/api/funnels')
      if (res.ok) setFunnels(await res.json())
    } catch {
      addToast('Failed to load funnels', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createFunnel() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        setNewName('')
        addToast('Funnel created', 'success')
        loadFunnels()
      } else {
        addToast('Failed to create funnel', 'error')
      }
    } catch {
      addToast('Failed to create funnel', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function deleteFunnel(id: string) {
    if (!confirm('Delete this funnel and all its pages?')) return
    try {
      await fetch(`/api/funnels/${id}`, { method: 'DELETE' })
      addToast('Funnel deleted', 'success')
      if (expandedId === id) { setExpandedId(null); setDetail(null) }
      loadFunnels()
    } catch {
      addToast('Failed to delete funnel', 'error')
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/funnels/${id}`)
      if (res.ok) setDetail(await res.json())
    } catch {
      addToast('Failed to load funnel details', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  async function updateFunnelName(id: string) {
    if (!editName.trim()) return
    try {
      await fetch(`/api/funnels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      setEditingName(null)
      addToast('Funnel updated', 'success')
      loadFunnels()
      if (detail && detail.id === id) {
        setDetail({ ...detail, name: editName.trim() })
      }
    } catch {
      addToast('Failed to update funnel', 'error')
    }
  }

  async function addPage(funnelId: string) {
    if (!newPageName.trim()) return
    try {
      const res = await fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPageName.trim() }),
      })
      if (res.ok) {
        setNewPageName('')
        setAddingPage(false)
        addToast('Page added', 'success')
        const detailRes = await fetch(`/api/funnels/${funnelId}`)
        if (detailRes.ok) setDetail(await detailRes.json())
        loadFunnels()
      }
    } catch {
      addToast('Failed to add page', 'error')
    }
  }

  async function reorderPage(funnelId: string, pageId: string, direction: 'up' | 'down') {
    if (!detail) return
    const pages = [...detail.pages].sort((a, b) => a.sort_order - b.sort_order)
    const idx = pages.findIndex((p) => p.id === pageId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= pages.length) return

    const orderA = pages[idx].sort_order
    const orderB = pages[swapIdx].sort_order

    await Promise.all([
      fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pages[idx].id, sort_order: orderB }),
      }),
      fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: pages[swapIdx].id, sort_order: orderA }),
      }),
    ])

    const refreshRes = await fetch(`/api/funnels/${funnelId}`)
    if (refreshRes.ok) setDetail(await refreshRes.json())
  }

  return (
    <>
      <Header title="Funnels" subtitle="Build and manage landing page funnels" />
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Create funnel */}
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createFunnel()}
            placeholder="New funnel name..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
          />
          <button
            onClick={createFunnel}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            <Plus size={14} /> Create Funnel
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading funnels...</div>
        ) : funnels.length === 0 ? (
          <div className="text-center py-20">
            <Layers size={40} className="mx-auto text-gray-300 dark:text-white/20 mb-3" />
            <p className="text-gray-500 dark:text-white/40 text-sm">No funnels yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {funnels.map((f) => (
              <div key={f.id} className="border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/[0.03] overflow-hidden">
                {/* Summary row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => toggleExpand(f.id)} className="text-gray-400 hover:text-gray-600">
                    {expandedId === f.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingName === f.id ? (
                      <div className="flex gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && updateFunnelName(f.id)}
                          className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm flex-1"
                          autoFocus
                        />
                        <button onClick={() => updateFunnelName(f.id)} className="text-xs px-2 py-1 rounded bg-[#015035] text-white">Save</button>
                        <button onClick={() => setEditingName(null)} className="text-xs px-2 py-1 rounded text-gray-500">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{f.name}</span>
                        <button onClick={() => { setEditingName(f.id); setEditName(f.name) }} className="text-gray-400 hover:text-gray-600">
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    f.status === 'Published'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
                  }`}>{f.status}</span>
                  <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-white/40">
                    <span className="flex items-center gap-1"><FileText size={12} /> {f.pageCount} pages</span>
                    <span className="flex items-center gap-1"><Eye size={12} /> {f.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Target size={12} /> {f.conversions.toLocaleString()}</span>
                    <span className="font-medium text-[#015035] dark:text-emerald-400">{f.conversionRate}%</span>
                  </div>
                  <button onClick={() => deleteFunnel(f.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded detail */}
                {expandedId === f.id && (
                  <div className="border-t border-gray-100 dark:border-white/5 px-5 py-5 bg-gray-50/50 dark:bg-white/[0.01]">
                    {detailLoading ? (
                      <p className="text-sm text-gray-400">Loading...</p>
                    ) : detail ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">Funnel Pipeline</p>
                        <div className="flex items-start gap-2 overflow-x-auto pb-2">
                          {[...detail.pages].sort((a, b) => a.sort_order - b.sort_order).map((page, i, arr) => (
                            <div key={page.id} className="flex items-center gap-2">
                              <div className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-white dark:bg-white/[0.04] min-w-[180px]">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <GripVertical size={12} className="text-gray-300" />
                                  <span className="text-[10px] font-semibold text-gray-400 dark:text-white/30">STEP {i + 1}</span>
                                  <div className="ml-auto flex gap-1">
                                    <button
                                      onClick={() => reorderPage(detail.id, page.id, 'up')}
                                      disabled={i === 0}
                                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      onClick={() => reorderPage(detail.id, page.id, 'down')}
                                      disabled={i === arr.length - 1}
                                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{page.name}</p>
                                <div className="flex gap-3 text-xs text-gray-500 dark:text-white/40">
                                  <span>{page.views} views</span>
                                  <span>{page.conversions} conv.</span>
                                </div>
                                <button
                                  onClick={() => router.push(`/funnels/editor?funnel=${detail.id}&page=${page.id}`)}
                                  className="mt-3 text-xs text-[#015035] dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
                                >
                                  <Pencil size={10} /> Edit page
                                </button>
                              </div>
                              {i < arr.length - 1 && (
                                <ArrowRight size={16} className="text-gray-300 dark:text-white/20 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 items-center pt-2">
                          {addingPage ? (
                            <div className="flex gap-2">
                              <input
                                value={newPageName}
                                onChange={(e) => setNewPageName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addPage(detail.id)}
                                placeholder="Page name..."
                                className="px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm"
                                autoFocus
                              />
                              <button onClick={() => addPage(detail.id)} className="text-xs px-3 py-1 rounded bg-[#015035] text-white">Add</button>
                              <button onClick={() => { setAddingPage(false); setNewPageName('') }} className="text-xs px-2 py-1 text-gray-500">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingPage(true)}
                              className="text-xs text-[#015035] dark:text-emerald-400 font-medium flex items-center gap-1 hover:underline"
                            >
                              <Plus size={12} /> Add step
                            </button>
                          )}

                          {detail.status === 'Published' && (
                            <a
                              href={`/go/page/${detail.slug}`}
                              target="_blank"
                              className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                              <ExternalLink size={11} /> View live
                            </a>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
