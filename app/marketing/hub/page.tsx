'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import {
  Mail, Share2, ClipboardList, Layers, Search, BookOpen,
  Send, ArrowRight, RefreshCw,
} from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all-pages'

const CARDS = [
  { title: 'Broadcasts',    href: '/marketing',      icon: <Mail size={20} />,          color: '#015035', description: 'Email campaigns and broadcasts' },
  { title: 'Social Media',  href: '/social',         icon: <Share2 size={20} />,        color: '#3b82f6', description: 'Schedule and manage social posts' },
  { title: 'Forms',         href: '/forms',          icon: <ClipboardList size={20} />, color: '#22c55e', description: 'Lead capture and intake forms' },
  { title: 'Funnels',       href: '/funnels',        icon: <Layers size={20} />,        color: '#8b5cf6', description: 'Conversion funnels and landing pages' },
  { title: 'Rank Tracker',  href: '/rank-tracker',   icon: <Search size={20} />,        color: '#f59e0b', description: 'SEO keyword position tracking' },
  { title: 'Knowledge Base', href: '/knowledge-base', icon: <BookOpen size={20} />,      color: '#0ea5e9', description: 'Articles and documentation' },
]

export default function MarketingHub() {
  const [emailsSent, setEmailsSent] = useState<number | null>(null)
  const [formSubs, setFormSubs] = useState<number | null>(null)
  const [keywords, setKeywords] = useState<number | null>(null)
  const [socialPosts, setSocialPosts] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadKPIs() {
    setRefreshing(true)
    try {
      const [broadcastsRes, formsRes, kws, postsRes] = await Promise.all([
        fetch('/api/broadcasts').then(r => r.ok ? r.json() : { data: [] }),
        fetch('/api/forms').then(r => r.ok ? r.json() : { data: [] }),
        // /api/rank-tracker/keywords is cursor-paginated (100/page) — fetch
        // the complete count instead of just the first page's length.
        fetchAllPages<unknown>('/api/rank-tracker/keywords'),
        fetch('/api/social-posts').then(r => r.ok ? r.json() : { data: [] }),
      ])

      const broadcasts = Array.isArray(broadcastsRes) ? broadcastsRes : (broadcastsRes.data ?? [])
      const sent = broadcasts
        .filter((b: { status: string }) => b.status === 'sent')
        .reduce((s: number, b: { totalSent?: number }) => s + (b.totalSent ?? 0), 0)
      setEmailsSent(sent)

      const forms = Array.isArray(formsRes) ? formsRes : (formsRes.data ?? [])
      const subs = forms.reduce((s: number, f: { submissionsCount?: number }) => s + (f.submissionsCount ?? 0), 0)
      setFormSubs(subs)

      setKeywords(kws.length)

      const posts = Array.isArray(postsRes) ? postsRes : (postsRes.data ?? [])
      setSocialPosts(posts.length)
    } catch { /* non-fatal */ }
    setRefreshing(false)
  }

  useEffect(() => { loadKPIs() }, [])

  const kpiItems = [
    { label: 'Emails Sent', value: emailsSent !== null ? emailsSent.toLocaleString() : '...', icon: <Send size={16} />, color: '#015035' },
    { label: 'Form Submissions', value: formSubs !== null ? formSubs.toLocaleString() : '...', icon: <ClipboardList size={16} />, color: '#3b82f6' },
    { label: 'Keywords Tracked', value: keywords !== null ? keywords.toString() : '...', icon: <Search size={16} />, color: '#8b5cf6' },
    { label: 'Social Posts', value: socialPosts !== null ? socialPosts.toString() : '...', icon: <Share2 size={16} />, color: '#f59e0b' },
  ]

  return (
    <>
      <Header title="Marketing" subtitle="Campaigns, content, and engagement" />
      <main className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={loadKPIs}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiItems.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.color + '14', color: k.color }}>
                {k.icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CARDS.map(c => (
            <Link
              key={c.title}
              href={c.href}
              className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + '14', color: c.color }}>
                  {c.icon}
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
