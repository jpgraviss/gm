'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { PLATFORM_META, type SocialPlatform, type PostStatus } from '@/lib/social-media'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import {
  Calendar, List, ChevronLeft, ChevronRight, X, Send, Clock, Check,
  AlertTriangle, Trash2, Eye, Pencil, Plus, Loader2, Wand2, Link2,
} from 'lucide-react'

interface SocialPost {
  id: string
  companyName: string
  content: string
  platforms: SocialPlatform[]
  scheduledAt?: string
  publishedAt?: string
  status: PostStatus
  approvalStatus: 'pending' | 'approved' | 'rejected'
  hashtags: string[]
  linkUrl?: string
  mediaUrls: string[]
  createdAt: string
}

interface ClientBinding { companyName: string }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:             { bg: '#f3f4f6', color: '#6b7280' },
  scheduled:         { bg: '#dbeafe', color: '#1e40af' },
  pending_approval:  { bg: '#fef3c7', color: '#92400e' },
  approved:          { bg: '#d1fae5', color: '#065f46' },
  rejected:          { bg: '#fee2e2', color: '#991b1b' },
  publishing:        { bg: '#fef3c7', color: '#92400e' },
  published:         { bg: '#d1fae5', color: '#065f46' },
  failed:            { bg: '#fee2e2', color: '#991b1b' },
}

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const m = PLATFORM_META[platform]
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${m.color}18`, color: m.color }}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── Calendar helpers ──────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function startDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function SocialMediaPage() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [clients, setClients] = useState<ClientBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all')
  const [composing, setComposing] = useState<SocialPost | null | 'new'>(null)
  const [showConnections, setShowConnections] = useState(false)

  // Calendar state
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  // AUDIT.md #212 — raw fetch() against a route cursor-paginated at 100
  // rows silently truncated the post list past that.
  const loadPosts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (clientFilter) params.set('company', clientFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    fetchAllPages<SocialPost>(`/api/social-posts?${params}`)
      .then(setPosts)
      .catch(() => toast('Failed to load posts', 'error'))
      .finally(() => setLoading(false))
  }, [clientFilter, statusFilter, toast])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    fetch('/api/client-integrations')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setClients(data) })
      .catch(() => {})
  }, [])

  // Surface LinkedIn OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('li_ok')) {
      toast('LinkedIn connected', 'success')
      window.history.replaceState({}, '', '/social')
    } else if (params.get('li_err')) {
      toast(`LinkedIn connection failed: ${params.get('li_err')}`, 'error')
      window.history.replaceState({}, '', '/social')
    }
  }, [toast])

  const filtered = posts

  // Group posts by date for calendar
  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const p of filtered) {
      const dateKey = (p.scheduledAt ?? p.createdAt).slice(0, 10)
      const arr = map.get(dateKey) ?? []
      arr.push(p)
      map.set(dateKey, arr)
    }
    return map
  }, [filtered])

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const totalDays = daysInMonth(calYear, calMonth)
  const startDay = startDayOfWeek(calYear, calMonth)
  const todayStr = now.toISOString().slice(0, 10)

  async function createPost(data: { companyName: string; content: string; platforms: SocialPlatform[]; scheduledAt?: string; hashtags?: string[]; linkUrl?: string; status?: PostStatus }) {
    try {
      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { toast('Failed to create post', 'error'); return }
      toast('Post created', 'success')
      setComposing(null)
      loadPosts()
    } catch { toast('Failed to create post', 'error') }
  }

  async function updatePost(id: string, patch: Partial<SocialPost>) {
    try {
      const res = await fetch(`/api/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { toast('Failed to update', 'error'); return }
      toast('Updated', 'success')
      setComposing(null)
      loadPosts()
    } catch { toast('Failed to update', 'error') }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    try {
      await fetch(`/api/social-posts/${id}`, { method: 'DELETE' })
      setPosts(prev => prev.filter(p => p.id !== id))
      setComposing(null)
      toast('Deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
  }

  async function publishPost(id: string) {
    if (!confirm('Publish this post now?')) return
    try {
      const res = await fetch(`/api/social-posts/${id}/publish`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast(data?.error || 'Failed to publish — check platform connections', 'error')
        setComposing(null)
        loadPosts()
        return
      }
      if (data?.partial) {
        const failed = Object.keys(data?.platformErrors ?? {})
        toast(`Published, but ${failed.join(', ')} failed`, 'error')
      } else {
        toast('Published', 'success')
      }
      setComposing(null)
      loadPosts()
    } catch { toast('Failed to publish', 'error') }
  }

  return (
    <>
      <Header title="Social Media" subtitle={`${posts.length} posts`} action={{ label: 'New Post', onClick: () => setComposing('new') }} />
      <div className="p-3 sm:p-6 flex-1 flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:max-w-xs"
          >
            <option value="">All clients</option>
            {clients.map(c => <option key={c.companyName} value={c.companyName}>{c.companyName}</option>)}
          </select>

          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {(['all', 'draft', 'scheduled', 'pending_approval', 'published'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0 capitalize ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            <button onClick={() => setShowConnections(true)} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium flex items-center gap-1.5"><Link2 size={14} /> Connections</button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-lg ${view === 'calendar' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}><Calendar size={14} /></button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}><List size={14} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: '#015035' }} /></div>
        ) : view === 'calendar' ? (
          /* ── Calendar view ── */
          <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <h3 className="text-sm font-bold text-gray-900">{monthLabel}</h3>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="bg-gray-50 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">{d}</div>
              ))}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white min-h-[80px]" />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayPosts = postsByDate.get(dateStr) ?? []
                const isToday = dateStr === todayStr
                return (
                  <button key={day} onClick={() => { if (dayPosts.length > 0) setComposing(dayPosts[0]); else { setComposing('new') } }}
                    className={`bg-white min-h-[80px] p-1.5 text-left hover:bg-emerald-50/50 transition-colors ${isToday ? 'ring-2 ring-emerald-500 ring-inset' : ''}`}>
                    <span className={`text-xs font-semibold ${isToday ? 'text-emerald-700' : 'text-gray-700'}`}>{day}</span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {dayPosts.slice(0, 3).map(p => (
                        <div key={p.id} className="flex gap-0.5">
                          {p.platforms.map(pl => (
                            <div key={pl} className="w-2 h-2 rounded-full" style={{ background: PLATFORM_META[pl]?.color ?? '#999' }} title={`${p.companyName}: ${PLATFORM_META[pl]?.label}`} />
                          ))}
                        </div>
                      ))}
                      {dayPosts.length > 3 && <span className="text-[9px] text-gray-400">+{dayPosts.length - 3}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── List view ── */
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No posts yet</p>
                <button onClick={() => setComposing('new')} className="mt-3 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#015035' }}>Create Post</button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(p => {
                  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.draft
                  return (
                    <button key={p.id} onClick={() => setComposing(p)} className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-gray-500">{p.companyName}</p>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{p.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-900 truncate">{p.content.slice(0, 120)}{p.content.length > 120 ? '…' : ''}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {p.platforms.map(pl => <PlatformBadge key={pl} platform={pl} />)}
                          {p.scheduledAt && <span className="text-[10px] text-gray-400 ml-auto">{formatDate(p.scheduledAt)}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Composer panel ── */}
      {composing && (
        <PostComposer
          post={composing === 'new' ? null : composing}
          clients={clients.map(c => c.companyName)}
          onClose={() => setComposing(null)}
          onCreate={createPost}
          onUpdate={updatePost}
          onDelete={deletePost}
          onPublish={publishPost}
        />
      )}

      {showConnections && <SocialConnectionsModal onClose={() => setShowConnections(false)} />}
    </>
  )
}

// ─── Social connections modal ──────────────────────────────────────────────

interface ConnStatus { platform: SocialPlatform; connected: boolean; accountLabel: string | null }
interface AvailAccount { platform: SocialPlatform; externalId: string; label: string; token?: string }

function SocialConnectionsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [statuses, setStatuses] = useState<ConnStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState<{ platform: SocialPlatform; accounts: AvailAccount[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/social/connections')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (Array.isArray(d)) setStatuses(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // Discover selectable accounts for a platform, then show the picker.
  async function choose(platform: SocialPlatform) {
    setBusy(true)
    try {
      const res = await fetch(`/api/social/connections/available?platform=${platform}`)
      const data = await res.json()
      if (!res.ok) { toast(data?.error || 'Connect the platform first', 'error'); return }
      if (!Array.isArray(data) || data.length === 0) { toast('No accounts found for this platform', 'error'); return }
      setPicker({ platform, accounts: data })
    } catch { toast('Failed to load accounts', 'error') }
    finally { setBusy(false) }
  }

  async function save(acc: AvailAccount) {
    setBusy(true)
    try {
      const res = await fetch('/api/social/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: acc.platform, externalId: acc.externalId, accountLabel: acc.label, token: acc.token }),
      })
      if (!res.ok) { toast('Failed to save connection', 'error'); return }
      toast('Connected', 'success')
      setPicker(null)
      load()
    } catch { toast('Failed to save connection', 'error') }
    finally { setBusy(false) }
  }

  async function disconnect(platform: SocialPlatform) {
    if (platform === 'linkedin') {
      await fetch('/api/integrations/linkedin/disconnect', { method: 'POST' }).catch(() => {})
    } else {
      await fetch(`/api/social/connections?platform=${platform}`, { method: 'DELETE' }).catch(() => {})
    }
    toast('Disconnected', 'success')
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
          <h2 className="text-white font-bold text-sm">Social Connections</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Connect the account each platform publishes to. Google Business works today; Facebook,
            Instagram, and LinkedIn require completing each platform&rsquo;s app review before posts go live.
          </p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#015035' }} /></div>
          ) : picker ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">Select a {PLATFORM_META[picker.platform].label} account:</p>
              {picker.accounts.map(acc => (
                <button key={acc.externalId} disabled={busy} onClick={() => save(acc)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-left disabled:opacity-50">
                  <span className="text-sm text-gray-800">{acc.label}</span>
                  <Check size={14} className="text-emerald-600" />
                </button>
              ))}
              <button onClick={() => setPicker(null)} className="text-xs text-gray-500 mt-1 self-start hover:underline">← Back</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {statuses.map(s => (
                <div key={s.platform} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: PLATFORM_META[s.platform].color }}>
                    {PLATFORM_META[s.platform].icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{PLATFORM_META[s.platform].label}</p>
                    <p className="text-[11px] text-gray-500 truncate">{s.connected ? s.accountLabel : 'Not connected'}</p>
                  </div>
                  {s.connected ? (
                    <button onClick={() => disconnect(s.platform)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100">Disconnect</button>
                  ) : s.platform === 'linkedin' ? (
                    <a href="/api/integrations/linkedin/connect" className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ background: '#015035' }}>Connect</a>
                  ) : (
                    <button disabled={busy} onClick={() => choose(s.platform)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#015035' }}>
                      {s.platform === 'google_business' ? 'Select location' : 'Select account'}
                    </button>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-gray-400 mt-1">
                Facebook/Instagram accounts come from your connected Meta account (Settings → Integrations).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Post composer side panel ──────────────────────────────────────────────

function PostComposer({ post, clients, onClose, onCreate, onUpdate, onDelete, onPublish }: {
  post: SocialPost | null
  clients: string[]
  onClose: () => void
  onCreate: (data: { companyName: string; content: string; platforms: SocialPlatform[]; scheduledAt?: string; hashtags?: string[]; linkUrl?: string; status?: PostStatus }) => void
  onUpdate: (id: string, patch: Partial<SocialPost>) => void
  onDelete: (id: string) => void
  onPublish: (id: string) => void
}) {
  const [company, setCompany] = useState(post?.companyName ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(post?.platforms ?? ['facebook', 'instagram'])
  const [scheduledAt, setScheduledAt] = useState(post?.scheduledAt?.slice(0, 16) ?? '')
  const [hashtags, setHashtags] = useState((post?.hashtags ?? []).join(', '))
  const [linkUrl, setLinkUrl] = useState(post?.linkUrl ?? '')

  const [aiLoading, setAiLoading] = useState(false)
  const isEditing = !!post
  const canSave = company.trim() && content.trim() && platforms.length > 0

  function togglePlatform(p: SocialPlatform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function handleSave(status?: PostStatus) {
    const tags = hashtags.split(',').map(t => t.trim()).filter(Boolean)
    if (isEditing) {
      onUpdate(post.id, { content, platforms, scheduledAt: scheduledAt || undefined, hashtags: tags, linkUrl: linkUrl || undefined, status })
    } else {
      onCreate({ companyName: company, content, platforms, scheduledAt: scheduledAt || undefined, hashtags: tags, linkUrl: linkUrl || undefined, status })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(560px,100vw)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">{isEditing ? 'Edit Post' : 'New Post'}</h2>
            {isEditing && <p className="text-white/60 text-xs">{post.status.replace('_', ' ')} · {post.companyName}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {!isEditing && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Client</label>
              <select value={company} onChange={e => setCompany(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select client…</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Content</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={async () => {
                    setAiLoading(true)
                    try {
                      const res = await fetch('/api/ai/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'social_post',
                          context: {
                            topic: company || 'marketing',
                            platform: platforms[0] || 'LinkedIn',
                            url: linkUrl || '',
                            additionalContext: content || '',
                          },
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setContent(data.content)
                      }
                    } catch { /* ignore */ }
                    setAiLoading(false)
                  }}
                  className="flex items-center gap-1 text-[10px] font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-40"
                >
                  {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                  AI Post
                </button>
                <span className="text-[10px] text-gray-400">{content.length} chars</span>
              </div>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="What do you want to share?"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-2">
              {(['facebook', 'instagram', 'linkedin', 'google_business'] as SocialPlatform[]).map(p => {
                const m = PLATFORM_META[p]
                const active = platforms.includes(p)
                return (
                  <button key={p} onClick={() => togglePlatform(p)} type="button"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={active ? { background: m.color } : {}}>
                    {m.icon} {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Schedule</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hashtags</label>
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#marketing, #seo, #growth"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Link URL</label>
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {isEditing && post.approvalStatus === 'pending' && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 flex-1">Awaiting approval</p>
              <button onClick={() => onUpdate(post.id, { approvalStatus: 'approved' } as Partial<SocialPost>)}
                className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100">Approve</button>
              <button onClick={() => onUpdate(post.id, { approvalStatus: 'rejected' } as Partial<SocialPost>)}
                className="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100">Reject</button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => handleSave()} disabled={!canSave} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>Save</button>
              {post.status === 'draft' || post.status === 'approved' ? (
                <button onClick={() => onPublish(post.id)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5"><Send size={13} /> Publish</button>
              ) : null}
              <button onClick={() => onDelete(post.id)} className="p-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
            </>
          ) : (
            <>
              <button onClick={() => handleSave('draft')} disabled={!canSave} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">
                Save Draft
              </button>
              <button onClick={() => handleSave('pending_approval')} disabled={!canSave} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5" style={{ background: '#015035' }}>
                <Eye size={13} /> Submit for Approval
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
