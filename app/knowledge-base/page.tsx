'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Search, BookOpen, Rocket, Users, TrendingUp, Megaphone, Settings2,
  CreditCard, Plug, ShieldCheck, Plus, X, Eye, EyeOff, Trash2, Tag,
  ChevronLeft, FileText, Clock, Filter,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Article {
  id: string
  title: string
  body: string
  category: string
  tags: string[]
  author: string | null
  status: 'draft' | 'published'
  views: number
  created_at: string
  updated_at: string
}

type Category = typeof CATEGORIES[number]['name']

// ─── Config ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Getting Started', icon: <Rocket size={20} />,      color: 'bg-emerald-100 text-emerald-700', accent: '#015035' },
  { name: 'CRM',             icon: <Users size={20} />,       color: 'bg-blue-100 text-blue-700',       accent: '#2563eb' },
  { name: 'Sales',           icon: <TrendingUp size={20} />,  color: 'bg-purple-100 text-purple-700',   accent: '#7c3aed' },
  { name: 'Marketing',       icon: <Megaphone size={20} />,   color: 'bg-pink-100 text-pink-700',       accent: '#db2777' },
  { name: 'Operations',      icon: <Settings2 size={20} />,   color: 'bg-amber-100 text-amber-700',     accent: '#d97706' },
  { name: 'Billing',         icon: <CreditCard size={20} />,  color: 'bg-cyan-100 text-cyan-700',       accent: '#0891b2' },
  { name: 'Integrations',    icon: <Plug size={20} />,        color: 'bg-indigo-100 text-indigo-700',   accent: '#4f46e5' },
  { name: 'Admin',           icon: <ShieldCheck size={20} />, color: 'bg-red-100 text-red-700',         accent: '#dc2626' },
] as const

const categoryBadgeColors: Record<string, string> = {
  'Getting Started': 'bg-emerald-100 text-emerald-700',
  'CRM':             'bg-blue-100 text-blue-700',
  'Sales':           'bg-purple-100 text-purple-700',
  'Marketing':       'bg-pink-100 text-pink-700',
  'Operations':      'bg-amber-100 text-amber-700',
  'Billing':         'bg-cyan-100 text-cyan-700',
  'Integrations':    'bg-indigo-100 text-indigo-700',
  'Admin':           'bg-red-100 text-red-700',
}

// ─── Markdown renderer ──────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-1">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-2">$1</h2>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-[13px] px-1.5 py-0.5 rounded font-mono text-gray-800">$1</code>')
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 text-sm leading-relaxed">$1</li>')
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="my-2 space-y-1">${match}</ul>`)
  html = html.replace(/\n{2,}/g, '</p><p class="text-sm text-gray-700 leading-relaxed mb-2">')
  html = `<p class="text-sm text-gray-700 leading-relaxed mb-2">${html}</p>`
  return html
}

function excerpt(body: string, maxLen = 120): string {
  const plain = body.replace(/[#*`\-]/g, '').replace(/\n/g, ' ').trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
}

// ─── Editor Panel ───────────────────────────────────────────────────────────────

function EditorPanel({
  article,
  onClose,
  onSave,
  onDelete,
}: {
  article: Article | null
  onClose: () => void
  onSave: (data: { title: string; body: string; category: string; tags: string[]; status: string }, id?: string) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [category, setCategory] = useState(article?.category ?? 'Getting Started')
  const [status, setStatus] = useState(article?.status ?? 'draft')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(article?.tags ?? [])
  const [previewMode, setPreviewMode] = useState(false)

  const canSave = title.trim().length > 0

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white shadow-xl flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase" style={{ fontFamily: 'var(--font-heading)' }}>
            {article ? 'Edit Article' : 'New Article'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tags</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
              />
              <button onClick={addTag} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                <Tag size={14} className="text-gray-600" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700">Content (Markdown)</label>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {previewMode ? <EyeOff size={12} /> : <Eye size={12} />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewMode ? (
              <div
                className="border border-gray-200 rounded-lg px-4 py-3 min-h-[280px] bg-gray-50/50 prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
              />
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                placeholder="Write your article content using Markdown..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
          <div>
            {article && (
              <button
                onClick={() => onDelete(article.id)}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave({ title: title.trim(), body, category, tags, status }, article?.id)}
              disabled={!canSave}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              {article ? 'Save Changes' : 'Create Article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Article Detail View ────────────────────────────────────────────────────────

function ArticleView({ article, onBack, onEdit }: { article: Article; onBack: () => void; onEdit: () => void }) {
  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <ChevronLeft size={14} />
        Back to articles
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-3 ${categoryBadgeColors[article.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {article.category}
            </span>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{article.title}</h1>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            Edit
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
          {article.author && <span>By {article.author}</span>}
          <span className="flex items-center gap-1"><Clock size={11} /> Updated {new Date(article.updated_at).toLocaleDateString()}</span>
          <span className="flex items-center gap-1"><Eye size={11} /> {article.views} views</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${article.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {article.status}
          </span>
        </div>

        <div
          className="prose-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
        />

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-gray-100">
            {article.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                <Tag size={10} /> {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editArticle, setEditArticle] = useState<Article | null>(null)
  const [viewArticle, setViewArticle] = useState<Article | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { toast } = useToast()

  async function fetchArticles() {
    try {
      const res = await fetch('/api/knowledge-base')
      if (res.ok) {
        const data = await res.json()
        setArticles(data)
      }
    } catch (err) {
      console.error('Failed to fetch articles', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchArticles() }, [])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of articles) {
      counts[a.category] = (counts[a.category] ?? 0) + 1
    }
    return counts
  }, [articles])

  const filtered = useMemo(() => {
    let list = articles
    if (activeCategory) list = list.filter((a) => a.category === activeCategory)
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
    }
    return list
  }, [articles, activeCategory, statusFilter, search])

  async function handleSave(data: { title: string; body: string; category: string; tags: string[]; status: string }, id?: string) {
    try {
      const url = id ? `/api/knowledge-base/${id}` : '/api/knowledge-base'
      const method = id ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) throw new Error('Failed to save')
      toast(id ? 'Article updated' : 'Article created', 'success')
      setShowEditor(false)
      setEditArticle(null)
      fetchArticles()
    } catch {
      toast('Failed to save article', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this article?')) return
    try {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast('Article deleted', 'success')
      setShowEditor(false)
      setEditArticle(null)
      setViewArticle(null)
      fetchArticles()
    } catch {
      toast('Failed to delete article', 'error')
    }
  }

  if (viewArticle) {
    return (
      <>
        <Header title="Knowledge Base" subtitle="Internal help center" />
        <div className="p-4 md:p-6">
          <ArticleView
            article={viewArticle}
            onBack={() => setViewArticle(null)}
            onEdit={() => { setEditArticle(viewArticle); setShowEditor(true); setViewArticle(null) }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Knowledge Base"
        subtitle="Internal help center"
        action={{ label: 'New Article', onClick: () => { setEditArticle(null); setShowEditor(true) } }}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] transition-shadow"
            />
          </div>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.name
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(isActive ? null : cat.name)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center ${
                  isActive
                    ? 'border-[#015035] bg-[#015035]/5 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                  {cat.icon}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isActive ? 'text-[#015035]' : 'text-gray-900'}`}>{cat.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{categoryCounts[cat.name] ?? 0} articles</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#015035]/10 text-[#015035] text-xs font-medium hover:bg-[#015035]/20 transition-colors"
              >
                {activeCategory}
                <X size={11} />
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter size={12} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-gray-600 border-0 focus:outline-none cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Article List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#015035] rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400 mt-3">Loading articles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No articles found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || activeCategory ? 'Try adjusting your search or filters' : 'Create your first knowledge base article'}
            </p>
            {!search && !activeCategory && (
              <button
                onClick={() => { setEditArticle(null); setShowEditor(true) }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                <Plus size={14} />
                New Article
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((article) => (
              <button
                key={article.id}
                onClick={() => setViewArticle(article)}
                className="w-full text-left flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-gray-100 transition-colors">
                  <FileText size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{article.title}</h3>
                    {article.status === 'draft' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 flex-shrink-0">
                        DRAFT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-2">{excerpt(article.body)}</p>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryBadgeColors[article.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {article.category}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(article.updated_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Eye size={10} />
                      {article.views}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor Panel */}
      {showEditor && (
        <EditorPanel
          article={editArticle}
          onClose={() => { setShowEditor(false); setEditArticle(null) }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
