'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  Star, Search, MessageSquare, Send, X, ChevronDown,
  TrendingUp, BarChart3, Clock, CheckCircle2, ExternalLink,
  RefreshCw, Plus, Settings,
} from 'lucide-react'

type ReviewSource = 'Google' | 'Yelp' | 'Facebook' | 'Manual'
type ReviewStatus = 'pending' | 'responded'
type FilterTab = 'all' | 'positive' | 'neutral' | 'negative' | 'needs_response'

interface Review {
  id: string
  workspace_id: string
  source: ReviewSource
  reviewer_name: string
  rating: number
  text: string
  date: string
  response: string | null
  response_date: string | null
  status: ReviewStatus
  google_review_id?: string | null
  location_name?: string | null
}

const SOURCE_COLORS: Record<ReviewSource, { bg: string; text: string }> = {
  Google: { bg: '#eef7ff', text: '#1a73e8' },
  Yelp: { bg: '#fff1f0', text: '#d32323' },
  Facebook: { bg: '#eef2ff', text: '#1877f2' },
  Manual: { bg: '#f3f4f6', text: '#6b7280' },
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'positive', label: 'Positive' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'negative', label: 'Negative' },
  { key: 'needs_response', label: 'Needs Response' },
]

function StarRating({ rating, size = 14, interactive, onSelect }: {
  rating: number
  size?: number
  interactive?: boolean
  onSelect?: (r: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={`${i <= rating ? 'text-amber-400' : 'text-gray-200'} ${interactive ? 'cursor-pointer' : ''}`}
          fill={i <= rating ? '#fbbf24' : 'none'}
          onClick={interactive ? () => onSelect?.(i) : undefined}
        />
      ))}
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export default function ReputationPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestEmail, setRequestEmail] = useState('')
  const [requestName, setRequestName] = useState('')

  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addSource, setAddSource] = useState<ReviewSource>('Google')
  const [addName, setAddName] = useState('')
  const [addRating, setAddRating] = useState(5)
  const [addText, setAddText] = useState('')
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10))
  const [addSubmitting, setAddSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/reputation/reviews')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setReviews(data) })
      .finally(() => setLoading(false))

    fetch('/api/settings')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const syncTime = d?.google_reviews?.lastSyncAt
        if (syncTime) setLastSyncAt(syncTime)
      })
      .catch(() => {})
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/reputation/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMessage(data.error || 'Sync failed')
        return
      }
      setSyncMessage(`Synced ${data.total} reviews (${data.new} new, ${data.updated} updated)`)
      setLastSyncAt(data.lastSyncAt)
      const reviewsRes = await fetch('/api/reputation/reviews')
      const reviewsData = await reviewsRes.json()
      if (Array.isArray(reviewsData)) setReviews(reviewsData)
    } catch {
      setSyncMessage('Failed to sync reviews')
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddReview() {
    if (!addName.trim() || !addRating) return
    setAddSubmitting(true)
    try {
      const res = await fetch('/api/reputation/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_review',
          source: addSource,
          reviewer_name: addName.trim(),
          rating: addRating,
          text: addText.trim(),
          date: new Date(addDate).toISOString(),
        }),
      })
      if (res.ok) {
        const review = await res.json()
        setReviews((prev) => [review, ...prev])
        setAddModalOpen(false)
        setAddName('')
        setAddRating(5)
        setAddText('')
        setAddDate(new Date().toISOString().slice(0, 10))
        setAddSource('Google')
      }
    } finally {
      setAddSubmitting(false)
    }
  }

  const filtered = useMemo(() => {
    let result = [...reviews]

    if (activeTab === 'positive') result = result.filter((r) => r.rating >= 4)
    else if (activeTab === 'neutral') result = result.filter((r) => r.rating === 3)
    else if (activeTab === 'negative') result = result.filter((r) => r.rating <= 2)
    else if (activeTab === 'needs_response') result = result.filter((r) => r.status === 'pending')

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.reviewer_name.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q)
      )
    }

    return result
  }, [reviews, activeTab, search])

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 0, total: 0, thisMonth: 0, responseRate: 0 }
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    const now = new Date()
    const thisMonth = reviews.filter((r) => {
      const d = new Date(r.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    const responded = reviews.filter((r) => r.status === 'responded').length
    return {
      avg: Math.round(avg * 10) / 10,
      total: reviews.length,
      thisMonth,
      responseRate: Math.round((responded / reviews.length) * 100),
    }
  }, [reviews])

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0]
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++
    })
    return dist.reverse()
  }, [reviews])

  async function handleRespond(reviewId: string) {
    if (!responseText.trim()) return
    setSubmitting(true)
    try {
      const review = reviews.find((r) => r.id === reviewId)
      const res = await fetch('/api/reputation/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          response: responseText.trim(),
          postToGoogle: review?.source === 'Google' && !!review?.google_review_id,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        setResponseText('')
        setExpandedId(null)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const kpis = [
    { label: 'Average Rating', value: stats.avg.toFixed(1), icon: <Star size={18} />, color: '#f59e0b', sub: <StarRating rating={Math.round(stats.avg)} size={12} /> },
    { label: 'Total Reviews', value: stats.total.toString(), icon: <BarChart3 size={18} />, color: '#015035', sub: 'Across all platforms' },
    { label: 'Reviews This Month', value: stats.thisMonth.toString(), icon: <TrendingUp size={18} />, color: '#3b82f6', sub: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
    { label: 'Response Rate', value: `${stats.responseRate}%`, icon: <MessageSquare size={18} />, color: '#8b5cf6', sub: `${reviews.filter((r) => r.status === 'responded').length} of ${stats.total} responded` },
  ]

  const maxCount = Math.max(...ratingDistribution, 1)

  return (
    <>
      <Header
        title="Reputation"
        subtitle="Monitor and manage your online reviews"
        action={{ label: 'Request Review', onClick: () => setRequestModalOpen(true) }}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Sync Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#01503514', color: '#015035' }}>
              <RefreshCw size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">Google Business Profile Sync</p>
              <p className="text-[11px] text-gray-400">
                {lastSyncAt ? `Last synced ${formatRelative(lastSyncAt)}` : 'Never synced'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {syncMessage && (
              <p className={`text-xs font-medium ${syncMessage.startsWith('Synced') ? 'text-emerald-600' : 'text-red-500'}`}>
                {syncMessage}
              </p>
            )}
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Plus size={13} />
              Add Review
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#015035' }}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Reviews'}
            </button>
            <Link
              href="/settings?tab=integrations"
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Integration Settings"
            >
              <Settings size={14} className="text-gray-400" />
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="metric-card flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: kpi.color + '14', color: kpi.color }}
              >
                {kpi.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{kpi.value}</p>
                <div className="text-[11px] text-gray-400 mt-1">{kpi.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rating Distribution + Review Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Rating Distribution */}
          <div className="metric-card">
            <h3 className="text-sm font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
              RATING DISTRIBUTION
            </h3>
            <div className="space-y-3">
              {ratingDistribution.map((count, idx) => {
                const starNum = 5 - idx
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
                return (
                  <div key={starNum} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-700">{starNum}</span>
                      <Star size={12} className="text-amber-400" fill="#fbbf24" />
                    </div>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: starNum >= 4 ? '#015035' : starNum === 3 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Sources</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {(['Google', 'Yelp', 'Facebook', 'Manual'] as ReviewSource[]).map((src) => {
                  const srcCount = reviews.filter((r) => r.source === src).length
                  if (srcCount === 0) return null
                  const c = SOURCE_COLORS[src]
                  return (
                    <div
                      key={src}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: c.bg, color: c.text }}
                    >
                      {src}
                      <span className="font-bold">{srcCount}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Review Feed */}
          <div className="metric-card !p-0 overflow-hidden">
            {/* Tabs + Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        activeTab === tab.key
                          ? 'text-white'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                      style={activeTab === tab.key ? { background: '#015035' } : undefined}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-56">
                  <Search size={13} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search reviews..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full"
                  />
                </div>
              </div>
            </div>

            {/* Review List */}
            <div className="divide-y divide-gray-50 max-h-[640px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading reviews...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No reviews found</div>
              ) : (
                filtered.map((review) => {
                  const isExpanded = expandedId === review.id
                  const srcColor = SOURCE_COLORS[review.source] ?? SOURCE_COLORS.Manual
                  return (
                    <div key={review.id} className="group">
                      <button
                        onClick={() => {
                          setExpandedId(isExpanded ? null : review.id)
                          setResponseText(review.response ?? '')
                        }}
                        className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: '#015035' }}
                          >
                            {review.reviewer_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{review.reviewer_name}</span>
                              <StarRating rating={review.rating} size={12} />
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: srcColor.bg, color: srcColor.text }}
                              >
                                {review.source}
                              </span>
                              {review.status === 'responded' ? (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                                  <CheckCircle2 size={10} />
                                  Responded
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
                                  <Clock size={10} />
                                  Awaiting Response
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{review.text}</p>
                            <p className="text-[10px] text-gray-300 mt-1.5">{formatRelative(review.date)}</p>
                          </div>
                          <ChevronDown
                            size={14}
                            className={`text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50/30">
                          <div className="pt-3">
                            <p className="text-sm text-gray-700 leading-relaxed">{review.text}</p>
                            <p className="text-xs text-gray-400 mt-2">{formatDate(review.date)}</p>
                          </div>

                          {review.response && (
                            <div className="mt-4 bg-white border border-gray-100 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#015035' }}>
                                  G
                                </div>
                                <span className="text-xs font-semibold text-gray-700">Your Response</span>
                                <span className="text-[10px] text-gray-400">{review.response_date ? formatDate(review.response_date) : ''}</span>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed">{review.response}</p>
                            </div>
                          )}

                          {review.status === 'pending' && (
                            <div className="mt-4">
                              <div className="flex items-start gap-2">
                                <textarea
                                  value={responseText}
                                  onChange={(e) => setResponseText(e.target.value)}
                                  placeholder="Write your response..."
                                  rows={3}
                                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2 mt-2">
                                <button
                                  onClick={() => setExpandedId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleRespond(review.id)}
                                  disabled={submitting || !responseText.trim()}
                                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                                  style={{ background: '#015035' }}
                                >
                                  <Send size={12} />
                                  {submitting ? 'Sending...' : 'Send Response'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Showing {filtered.length} of {reviews.length} reviews
                </p>
                <Link
                  href="/reputation/requests"
                  className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ color: '#015035' }}
                >
                  Manage Campaigns
                  <ExternalLink size={11} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Review Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRequestModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>
                  Request a Review
                </h2>
                <button onClick={() => setRequestModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client Name</label>
                <input
                  type="text"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 leading-relaxed">
                A personalized email will be sent with a direct link to leave a Google review. The email uses the &ldquo;Happy Client Follow-Up&rdquo; template.
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRequestModalOpen(false)
                  setRequestName('')
                  setRequestEmail('')
                }}
                disabled={!requestEmail.trim() || !requestName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                <Send size={13} />
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>
                  Add Review
                </h2>
                <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Source</label>
                <select
                  value={addSource}
                  onChange={(e) => setAddSource(e.target.value as ReviewSource)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] bg-white"
                >
                  <option value="Google">Google</option>
                  <option value="Yelp">Yelp</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reviewer Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Rating</label>
                <StarRating rating={addRating} size={24} interactive onSelect={setAddRating} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Review Text</label>
                <textarea
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Write the review text..."
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddReview}
                disabled={addSubmitting || !addName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                <Plus size={13} />
                {addSubmitting ? 'Adding...' : 'Add Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
