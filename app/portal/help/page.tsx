'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Search, BookOpen, Rocket, Users, TrendingUp, Megaphone, Settings2,
  CreditCard, Plug, ShieldCheck, ChevronRight, ThumbsUp, ThumbsDown,
  Clock, Eye, MessageSquare, ArrowLeft,
} from 'lucide-react'

interface Article {
  id: string
  title: string
  body: string
  category: string
  tags: string[]
  author: string | null
  views: number
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  { name: 'Getting Started', icon: Rocket,      color: 'bg-emerald-100 text-emerald-700' },
  { name: 'CRM',             icon: Users,       color: 'bg-blue-100 text-blue-700' },
  { name: 'Sales',           icon: TrendingUp,  color: 'bg-purple-100 text-purple-700' },
  { name: 'Marketing',       icon: Megaphone,   color: 'bg-pink-100 text-pink-700' },
  { name: 'Operations',      icon: Settings2,   color: 'bg-amber-100 text-amber-700' },
  { name: 'Billing',         icon: CreditCard,  color: 'bg-cyan-100 text-cyan-700' },
  { name: 'Integrations',    icon: Plug,        color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Admin',           icon: ShieldCheck, color: 'bg-red-100 text-red-700' },
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

function excerpt(body: string, maxLen = 140): string {
  const plain = body.replace(/[#*`\-]/g, '').replace(/\n/g, ' ').trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain
}

type View =
  | { kind: 'home' }
  | { kind: 'category'; category: string }
  | { kind: 'article'; article: Article }

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>({ kind: 'home' })
  const [feedback, setFeedback] = useState<Record<string, 'yes' | 'no'>>({})

  useEffect(() => {
    fetch('/api/portal/help')
      .then(r => r.ok ? r.json() : [])
      .then((data: Article[]) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function viewArticle(article: Article) {
    fetch(`/api/portal/help?id=${article.id}`).catch(() => {})
    setView({ kind: 'article', article })
  }

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of articles) {
      counts[a.category] = (counts[a.category] ?? 0) + 1
    }
    return counts
  }, [articles])

  const filtered = useMemo(() => {
    let list = articles
    if (view.kind === 'category') {
      list = list.filter(a => a.category === view.category)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
      )
    }
    return list
  }, [articles, view, search])

  const activeCategory = view.kind === 'category' ? view.category : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/portal/help" onClick={() => setView({ kind: 'home' })} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#015035' }}>
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
              Help Center
            </span>
          </Link>
          <Link
            href="/tickets"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            <MessageSquare size={14} />
            Contact Support
          </Link>
        </div>
      </header>

      {view.kind === 'article' ? (
        <ArticleDetailView
          article={view.article}
          feedback={feedback[view.article.id]}
          onFeedback={(val) => setFeedback(prev => ({ ...prev, [view.article.id]: val }))}
          onBack={() => setView(
            view.article.category && activeCategory
              ? { kind: 'category', category: view.article.category }
              : { kind: 'home' }
          )}
          onCategoryClick={(cat) => setView({ kind: 'category', category: cat })}
        />
      ) : (
        <>
          <div className="py-12 sm:py-16 text-center" style={{ background: 'linear-gradient(135deg, #015035 0%, #01804f 100%)' }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              How can we help?
            </h1>
            <p className="text-white/70 text-sm mb-6">Search our knowledge base or browse by category</p>
            <div className="max-w-xl mx-auto px-4">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for articles..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm text-gray-800 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30 placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {view.kind === 'category' && (
              <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
                <button onClick={() => setView({ kind: 'home' })} className="hover:text-[#015035] transition-colors">
                  Help Center
                </button>
                <ChevronRight size={12} />
                <span className="text-gray-900 font-medium">{view.category}</span>
              </nav>
            )}

            {view.kind === 'home' && !search && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const count = categoryCounts[cat.name] ?? 0
                  if (count === 0) return null
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setView({ kind: 'category', category: cat.name })}
                      className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-gray-200 bg-white hover:border-[#015035]/30 hover:shadow-sm transition-all text-center"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{count} article{count !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {view.kind === 'category' && (
              <button
                onClick={() => { setView({ kind: 'home' }); setSearch('') }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#015035] mb-4 transition-colors"
              >
                <ArrowLeft size={14} />
                All categories
              </button>
            )}

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
                  {search ? 'Try a different search term' : 'No published articles available yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(article => (
                  <button
                    key={article.id}
                    onClick={() => viewArticle(article)}
                    className="w-full text-left flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#015035]/30 hover:shadow-sm transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#015035]/5 transition-colors">
                      <BookOpen size={16} className="text-gray-400 group-hover:text-[#015035] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-[#015035] transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{excerpt(article.body)}</p>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${categoryBadgeColors[article.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {article.category}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(article.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 mt-2 flex-shrink-0 group-hover:text-[#015035] transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ArticleDetailView({
  article,
  feedback,
  onFeedback,
  onBack,
  onCategoryClick,
}: {
  article: Article
  feedback: 'yes' | 'no' | undefined
  onFeedback: (val: 'yes' | 'no') => void
  onBack: () => void
  onCategoryClick: (cat: string) => void
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <button onClick={onBack} className="hover:text-[#015035] transition-colors">
          Help Center
        </button>
        <ChevronRight size={12} />
        <button onClick={() => onCategoryClick(article.category)} className="hover:text-[#015035] transition-colors">
          {article.category}
        </button>
        <ChevronRight size={12} />
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{article.title}</span>
      </nav>

      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#015035] mb-5 transition-colors">
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-3 ${categoryBadgeColors[article.category] ?? 'bg-gray-100 text-gray-600'}`}>
          {article.category}
        </span>
        <h1 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
          {article.title}
        </h1>

        <div className="flex items-center gap-4 text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            Updated {new Date(article.updated_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={11} />
            {article.views} views
          </span>
        </div>

        <div
          className="prose-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
        />

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-8 pt-6 border-t border-gray-100">
            {article.tags.map(t => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">Was this article helpful?</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFeedback('yes')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-all ${
                feedback === 'yes'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <ThumbsUp size={14} />
              Yes
            </button>
            <button
              onClick={() => onFeedback('no')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-all ${
                feedback === 'no'
                  ? 'border-red-300 bg-red-50 text-red-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <ThumbsDown size={14} />
              No
            </button>
          </div>
          {feedback === 'no' && (
            <p className="text-xs text-gray-500 mt-3">
              Sorry this wasn&apos;t helpful.{' '}
              <Link href="/tickets" className="text-[#015035] font-medium hover:underline">
                Contact support
              </Link>{' '}
              for further assistance.
            </p>
          )}
          {feedback === 'yes' && (
            <p className="text-xs text-emerald-600 mt-3">Thanks for the feedback!</p>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Still need help?{' '}
          <Link
            href="/tickets"
            className="font-medium hover:underline"
            style={{ color: '#015035' }}
          >
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
  )
}
