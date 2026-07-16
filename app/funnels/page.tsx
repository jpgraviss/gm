'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Plus, Trash2, ArrowRight, Eye, Target, Pencil, ChevronDown,
  ChevronUp, ExternalLink, Layers, GripVertical, FileText,
  Search, X, TrendingUp, BarChart3, ArrowDownRight, Check,
  Gift, ArrowDownCircle, Sparkles, BookOpen,
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

type FilterTab = 'all' | 'Draft' | 'Published'

const FUNNEL_TEMPLATES = [
  {
    name: 'Lead Magnet',
    description: 'Capture leads with a free resource download',
    icon: <Gift size={20} />,
    color: '#8b5cf6',
    steps: ['Opt-in Page', 'Thank You Page'],
  },
  {
    name: 'Webinar Registration',
    description: 'Drive registrations and follow up after the event',
    icon: <BookOpen size={20} />,
    color: '#3b82f6',
    steps: ['Registration Page', 'Confirmation Page', 'Replay Page'],
  },
  {
    name: 'Sales Page',
    description: 'Present your offer and convert visitors into buyers',
    icon: <TrendingUp size={20} />,
    color: '#015035',
    steps: ['Sales Page', 'Order Form', 'Upsell Page', 'Thank You Page'],
  },
  {
    name: 'Tripwire Funnel',
    description: 'Low-ticket offer leading to a premium upsell',
    icon: <ArrowDownCircle size={20} />,
    color: '#ef4444',
    steps: ['Landing Page', 'Checkout', 'Upsell', 'Downsell', 'Confirmation'],
  },
]

export default function FunnelsPage() {
  const router = useRouter()
  const { toast: addToast } = useToast()
  const [funnels, setFunnels] = useState<FunnelSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<FunnelDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [editPageName, setEditPageName] = useState('')
  const [addingPage, setAddingPage] = useState(false)
  const [newPageName, setNewPageName] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  useEffect(() => {
    loadFunnels()
  }, [])

  const filteredFunnels = useMemo(() => {
    let result = funnels
    if (activeTab !== 'all') {
      result = result.filter((f) => f.status === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((f) => f.name.toLowerCase().includes(q))
    }
    return result
  }, [funnels, activeTab, searchQuery])

  const kpis = useMemo(() => {
    const total = funnels.length
    const published = funnels.filter((f) => f.status === 'Published').length
    const totalViews = funnels.reduce((sum, f) => sum + f.views, 0)
    const totalConversions = funnels.reduce((sum, f) => sum + f.conversions, 0)
    const avgRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0.0'
    return { total, published, totalViews, avgRate }
  }, [funnels])

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

  async function createFromTemplate(template: typeof FUNNEL_TEMPLATES[number]) {
    setCreatingFromTemplate(true)
    try {
      const res = await fetch('/api/funnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${template.name} Funnel` }),
      })
      if (res.ok) {
        const funnel = await res.json()
        const funnelId = funnel.id || funnel.funnelId
        for (let i = 0; i < template.steps.length; i++) {
          await fetch(`/api/funnels/${funnelId}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: template.steps[i] }),
          })
        }
        addToast(`"${template.name}" funnel created with ${template.steps.length} pages`, 'success')
        loadFunnels()
      } else {
        addToast('Failed to create funnel from template', 'error')
      }
    } catch {
      addToast('Failed to create funnel from template', 'error')
    } finally {
      setCreatingFromTemplate(false)
    }
  }

  // The API always creates a first page ("Landing Page") along with the
  // funnel itself — previously this response was discarded and the user
  // had to close the modal, expand the new funnel in the list, and click
  // through to find that page's editor link. Since a blank funnel is
  // already just "one page, no campaign steps" until more pages are added,
  // jumping straight to that page's editor turns this into a real
  // single-page "new landing page" quick-create flow with no schema
  // change and no separate landing-page concept to maintain.
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
        const created = await res.json() as FunnelDetail
        setNewName('')
        setShowCreateModal(false)
        addToast('Landing page created', 'success')
        const firstPage = created.pages?.[0]
        if (firstPage) {
          router.push(`/funnels/editor?funnel=${created.id}&page=${firstPage.id}`)
        } else {
          loadFunnels()
        }
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
      const res = await fetch(`/api/funnels/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        addToast(err.error || 'Failed to delete funnel', 'error')
        return
      }
      addToast('Funnel deleted', 'success')
      if (expandedId === id) { setExpandedId(null); setDetail(null) }
      loadFunnels()
    } catch {
      addToast('Failed to delete funnel', 'error')
    }
  }

  // The editor requires both a funnel id AND a page id — the list only
  // knows pageCount, not individual page ids, so this fetches the detail
  // first (same endpoint toggleExpand uses) to find the first real page to
  // open, rather than linking to a URL the editor can't ever resolve.
  async function editFunnel(id: string) {
    try {
      const res = await fetch(`/api/funnels/${id}`)
      if (!res.ok) throw new Error('Failed to load funnel')
      const funnelDetail = await res.json() as FunnelDetail
      const firstPage = [...(funnelDetail.pages ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]
      if (!firstPage) {
        addToast('This funnel has no pages yet — add one first', 'error')
        return
      }
      router.push(`/funnels/editor?funnel=${id}&page=${firstPage.id}`)
    } catch {
      addToast('Failed to open funnel editor', 'error')
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
      const res = await fetch(`/api/funnels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        addToast(err.error || 'Failed to update funnel', 'error')
        return
      }
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

  // Drag-and-drop reorder — replaces the old up/down-button swap. Reindexes
  // every page to its new position (0..n-1) rather than trying to diff just
  // the two swapped rows, so it self-heals any pre-existing sort_order gaps
  // instead of just working around them.
  async function reorderPages(funnelId: string, result: DropResult) {
    if (!detail || !result.destination) return
    const pages = [...detail.pages].sort((a, b) => a.sort_order - b.sort_order)
    const [moved] = pages.splice(result.source.index, 1)
    pages.splice(result.destination.index, 0, moved)
    const reindexed = pages.map((p, i) => ({ ...p, sort_order: i }))
    setDetail({ ...detail, pages: reindexed })

    try {
      const results = await Promise.all(
        reindexed.map((p) =>
          fetch(`/api/funnels/${funnelId}/pages`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: p.id, sort_order: p.sort_order }),
          }),
        ),
      )
      if (results.some((r) => !r.ok)) {
        addToast('Failed to save new page order', 'error')
        const refreshRes = await fetch(`/api/funnels/${funnelId}`)
        if (refreshRes.ok) setDetail(await refreshRes.json())
      }
    } catch {
      addToast('Failed to save new page order', 'error')
      const refreshRes = await fetch(`/api/funnels/${funnelId}`)
      if (refreshRes.ok) setDetail(await refreshRes.json())
    }
  }

  async function renamePage(funnelId: string, pageId: string) {
    if (!editPageName.trim()) return
    try {
      const res = await fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, name: editPageName.trim() }),
      })
      if (!res.ok) {
        addToast('Failed to rename page', 'error')
        return
      }
      setEditingPageId(null)
      addToast('Page renamed', 'success')
      if (detail) {
        setDetail({ ...detail, pages: detail.pages.map((p) => (p.id === pageId ? { ...p, name: editPageName.trim() } : p)) })
      }
    } catch {
      addToast('Failed to rename page', 'error')
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Draft', label: 'Draft' },
    { key: 'Published', label: 'Published' },
  ]

  return (
    <>
      <Header title="Funnels" subtitle="Build and manage landing page funnels" />
      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Funnels</h1>
            <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
              Create high-converting funnels to capture and convert leads.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:brightness-110 w-full sm:w-auto justify-center"
            style={{ background: '#015035' }}
          >
            <Plus size={16} /> Create Funnel
          </button>
        </div>

        {!loading && funnels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#015035]/10 dark:bg-[#015035]/20 flex items-center justify-center">
                  <Layers size={18} className="text-[#015035] dark:text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wider">Total Funnels</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.total}</p>
            </div>
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wider">Published</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.published}</p>
            </div>
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Eye size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wider">Total Views</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <BarChart3 size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-white/50 uppercase tracking-wider">Avg Conversion</span>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.avgRate}%</p>
            </div>
          </div>
        )}

        {!loading && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#015035]" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Quick Start Templates</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FUNNEL_TEMPLATES.map(template => (
                <div key={template.name} className="border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/[0.03] p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${template.color}15` }}>
                      <span style={{ color: template.color }}>{template.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{template.name}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-white/40 mb-3">{template.description}</p>
                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                    {template.steps.map((step, i) => (
                      <span key={step} className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/50 font-medium">{step}</span>
                        {i < template.steps.length - 1 && <ArrowRight size={10} className="text-gray-300 dark:text-white/20" />}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => createFromTemplate(template)}
                    disabled={creatingFromTemplate}
                    className="w-full text-xs font-semibold py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    {creatingFromTemplate ? 'Creating...' : 'Use Template'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && funnels.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex bg-gray-100 dark:bg-white/[0.06] rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search funnels..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30"
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-[#015035] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 dark:text-white/40 text-sm">Loading funnels...</p>
          </div>
        ) : funnels.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Layers size={28} className="text-gray-300 dark:text-white/20" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Create your first funnel</h3>
            <p className="text-sm text-gray-500 dark:text-white/40 mb-6 max-w-sm mx-auto">
              Build multi-step landing page funnels to guide visitors through your conversion process.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:brightness-110"
              style={{ background: '#015035' }}
            >
              <Plus size={16} /> Create Funnel
            </button>
          </div>
        ) : filteredFunnels.length === 0 ? (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto text-gray-300 dark:text-white/20 mb-3" />
            <p className="text-gray-500 dark:text-white/40 text-sm">No funnels match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {filteredFunnels.map((f) => (
              <div
                key={f.id}
                className="border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/[0.03] shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      {editingName === f.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateFunnelName(f.id)
                              if (e.key === 'Escape') setEditingName(null)
                            }}
                            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm flex-1 min-w-0"
                            autoFocus
                          />
                          <button onClick={() => updateFunnelName(f.id)} className="text-xs px-3 py-1 rounded-lg bg-[#015035] text-white font-medium">Save</button>
                          <button onClick={() => setEditingName(null)} className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{f.name}</h3>
                          <button
                            onClick={() => { setEditingName(f.id); setEditName(f.name) }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-white/60 flex-shrink-0"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className={`ml-3 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      f.status === 'Published'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50'
                    }`}>{f.status}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Pages</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.pageCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Views</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.views.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Conv.</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.conversions.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-white/30 mb-0.5">Rate</p>
                      <p className="text-sm font-semibold text-[#015035] dark:text-emerald-400">{f.conversionRate}%</p>
                    </div>
                  </div>

                  {f.pageCount === 1 ? (
                    <div className="flex items-center gap-1.5 py-2 px-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
                      <FileText size={12} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                      <span className="text-[11px] text-gray-500 dark:text-white/40 font-medium">Single landing page</span>
                    </div>
                  ) : f.pageCount > 0 ? (
                    <div className="flex items-center gap-1 py-2 px-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg overflow-x-auto">
                      {Array.from({ length: Math.min(f.pageCount, 5) }).map((_, i) => (
                        <div key={i} className="flex items-center gap-1 flex-shrink-0">
                          <div className="w-6 h-6 rounded bg-[#015035]/10 dark:bg-[#015035]/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-[#015035] dark:text-emerald-400">{i + 1}</span>
                          </div>
                          {i < Math.min(f.pageCount, 5) - 1 && (
                            <ArrowRight size={10} className="text-gray-300 dark:text-white/20 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                      {f.pageCount > 5 && (
                        <span className="text-[10px] text-gray-400 dark:text-white/30 ml-1 flex-shrink-0">+{f.pageCount - 5}</span>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-gray-100 dark:border-white/5 px-5 py-3 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 dark:text-white/30">
                    {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleExpand(f.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                      title="View details"
                    >
                      {expandedId === f.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button
                      onClick={() => editFunnel(f.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#015035] dark:hover:text-emerald-400 hover:bg-[#015035]/5 dark:hover:bg-[#015035]/10 transition-colors"
                      title="Edit funnel"
                    >
                      <Pencil size={15} />
                    </button>
                    {f.status === 'Published' && (
                      <a
                        href={`/go/page/${f.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                        title="View live"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      onClick={() => deleteFunnel(f.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete funnel"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {expandedId === f.id && (
                  <div className="border-t border-gray-100 dark:border-white/5 px-5 py-5 bg-gray-50/50 dark:bg-white/[0.01]">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        Loading pipeline...
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">
                          {detail.pages.length === 1 ? 'Landing Page' : 'Funnel Pipeline'}
                        </p>
                        <DragDropContext onDragEnd={(result) => reorderPages(detail.id, result)}>
                          <Droppable droppableId={`funnel-pages-${detail.id}`}>
                            {(dropProvided) => (
                              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-0">
                                {[...detail.pages].sort((a, b) => a.sort_order - b.sort_order).map((page, i, arr) => {
                                  const dropOff = i > 0 ? arr[i - 1].views - page.views : 0
                                  const dropOffPct = i > 0 && arr[i - 1].views > 0
                                    ? ((dropOff / arr[i - 1].views) * 100).toFixed(1)
                                    : null
                                  const standalone = arr.length === 1
                                  return (
                                    <Draggable key={page.id} draggableId={page.id} index={i} isDragDisabled={standalone}>
                                      {(dragProvided, dragSnapshot) => (
                                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                                          {i > 0 && (
                                            <div className="flex items-center gap-2 py-1 pl-4">
                                              <ArrowDownRight size={14} className="text-gray-300 dark:text-white/20" />
                                              {dropOffPct && (
                                                <span className="text-[10px] text-red-400 font-medium">-{dropOffPct}% drop-off ({dropOff})</span>
                                              )}
                                            </div>
                                          )}
                                          <div className={`border rounded-lg p-3.5 bg-white dark:bg-white/[0.04] ${dragSnapshot.isDragging ? 'shadow-lg border-gray-300 dark:border-white/20' : 'border-gray-200 dark:border-white/10'}`}>
                                            <div className="flex items-center gap-2 mb-2">
                                              {!standalone && (
                                                <div {...dragProvided.dragHandleProps} className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 cursor-grab flex-shrink-0">
                                                  <GripVertical size={12} />
                                                </div>
                                              )}
                                              <span className="text-[10px] font-bold text-[#015035]/60 dark:text-emerald-400/60 uppercase">
                                                {standalone ? 'Page' : `Step ${i + 1}`}
                                              </span>
                                            </div>
                                            {editingPageId === page.id ? (
                                              <div className="flex gap-1.5 mb-2">
                                                <input
                                                  value={editPageName}
                                                  onChange={(e) => setEditPageName(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') renamePage(detail.id, page.id)
                                                    if (e.key === 'Escape') setEditingPageId(null)
                                                  }}
                                                  className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
                                                  autoFocus
                                                />
                                                <button onClick={() => renamePage(detail.id, page.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded">
                                                  <Check size={13} />
                                                </button>
                                                <button onClick={() => setEditingPageId(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                                  <X size={13} />
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1.5 mb-2">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{page.name}</p>
                                                <button
                                                  onClick={() => { setEditingPageId(page.id); setEditPageName(page.name) }}
                                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white/60"
                                                >
                                                  <Pencil size={11} />
                                                </button>
                                              </div>
                                            )}
                                            <div className="flex gap-4 text-xs text-gray-500 dark:text-white/40">
                                              <span className="flex items-center gap-1"><Eye size={11} /> {page.views} views</span>
                                              <span className="flex items-center gap-1"><Target size={11} /> {page.conversions} conv.</span>
                                              {page.views > 0 && (
                                                <span className="text-[#015035] dark:text-emerald-400 font-medium">
                                                  {((page.conversions / page.views) * 100).toFixed(1)}%
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              onClick={() => router.push(`/funnels/editor?funnel=${detail.id}&page=${page.id}`)}
                                              className="mt-2.5 text-xs text-[#015035] dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
                                            >
                                              <Pencil size={10} /> Edit page
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  )
                                })}
                                {dropProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>

                        <div className="flex gap-2 items-center pt-1">
                          {addingPage ? (
                            <div className="flex gap-2 flex-1">
                              <input
                                value={newPageName}
                                onChange={(e) => setNewPageName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addPage(detail.id)
                                  if (e.key === 'Escape') { setAddingPage(false); setNewPageName('') }
                                }}
                                placeholder="Page name..."
                                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm flex-1"
                                autoFocus
                              />
                              <button onClick={() => addPage(detail.id)} className="text-xs px-3 py-1.5 rounded-lg bg-[#015035] text-white font-medium">Add</button>
                              <button onClick={() => { setAddingPage(false); setNewPageName('') }} className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddingPage(true)}
                              className="text-xs text-[#015035] dark:text-emerald-400 font-medium flex items-center gap-1 hover:underline"
                            >
                              <Plus size={12} /> {detail.pages.length === 1 ? 'Add another page' : 'Add step'}
                            </button>
                          )}

                          {detail.status === 'Published' && (
                            <a
                              href={`/go/page/${detail.slug}`}
                              target="_blank"
                              className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white/60 flex items-center gap-1"
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreateModal(false); setNewName('') }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-md mx-4 sm:mx-auto p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create new funnel</h2>
              <button
                onClick={() => { setShowCreateModal(false); setNewName('') }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white/60 mb-1.5">Funnel name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFunnel()}
              placeholder="e.g. Lead Magnet Funnel"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 mb-5"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setNewName('') }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFunnel}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-all hover:brightness-110"
                style={{ background: '#015035' }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
