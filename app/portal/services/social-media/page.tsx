'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Megaphone, Calendar, Heart, MessageCircle,
  Share2, Users, TrendingUp, Eye,
} from 'lucide-react'

interface SocialPost {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduledDate?: string
  publishedDate?: string
  engagement?: {
    likes: number
    comments: number
    shares: number
    impressions: number
  }
}

interface SocialData {
  posts: SocialPost[]
  totalFollowers: number
  followerGrowth: number
  totalEngagement: number
  avgReach: number
}

export default function PortalSocialMediaPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<SocialData>({
    posts: [],
    totalFollowers: 0,
    followerGrowth: 0,
    totalEngagement: 0,
    avgReach: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/social-posts?company=${encodeURIComponent(company)}&limit=20`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(result => {
        const posts: SocialPost[] = (result.data ?? result ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          content: (p.content as string ?? '').slice(0, 120),
          platforms: p.platforms as string[] ?? [],
          status: p.status as string ?? 'Draft',
          scheduledDate: p.scheduledDate as string ?? p.scheduled_date as string ?? undefined,
          publishedDate: p.publishedDate as string ?? p.published_date as string ?? undefined,
          engagement: {
            likes: (p.likes as number) ?? 0,
            comments: (p.comments as number) ?? 0,
            shares: (p.shares as number) ?? 0,
            impressions: (p.impressions as number) ?? 0,
          },
        }))
        const totalEngagement = posts.reduce((s, p) => s + (p.engagement?.likes ?? 0) + (p.engagement?.comments ?? 0) + (p.engagement?.shares ?? 0), 0)
        const totalImpressions = posts.reduce((s, p) => s + (p.engagement?.impressions ?? 0), 0)
        setData({
          posts,
          totalFollowers: 0,
          followerGrowth: 0,
          totalEngagement,
          avgReach: posts.length > 0 ? Math.round(totalImpressions / posts.length) : 0,
        })
      })
      .catch(() => toast('Failed to load social media data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#ec4899' }} />
      </div>
    )
  }

  const published = data.posts.filter(p => p.status === 'Published' || p.status === 'posted')
  const scheduled = data.posts.filter(p => p.status === 'Scheduled' || p.status === 'scheduled')

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Social Media</h1>
          <p className="text-xs text-gray-500 mt-0.5">Post calendar, engagement metrics, and audience growth</p>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Published Posts', value: published.length.toString(), icon: Megaphone, color: '#ec4899' },
            { label: 'Scheduled', value: scheduled.length.toString(), icon: Calendar, color: '#2563eb' },
            { label: 'Total Engagement', value: data.totalEngagement.toLocaleString(), icon: Heart, color: '#015035' },
            { label: 'Avg. Reach', value: data.avgReach.toLocaleString(), icon: Eye, color: '#7c3aed' },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}12` }}>
                    <Icon size={14} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>{card.value}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
              </div>
            )
          })}
        </div>

        {scheduled.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Upcoming Posts</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {scheduled.map(p => (
                <div key={p.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex gap-1 mt-0.5">
                      {p.platforms.map(pl => (
                        <span key={pl} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">{pl}</span>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{p.content}</p>
                      {p.scheduledDate && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Scheduled for {new Date(p.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Recent Posts</h3>
          </div>
          {published.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {published.slice(0, 10).map(p => (
                <div key={p.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {p.platforms.map(pl => (
                        <span key={pl} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-pink-50 text-pink-600">{pl}</span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 truncate flex-1">{p.content}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
                      <span className="flex items-center gap-0.5"><Heart size={10} />{p.engagement?.likes ?? 0}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle size={10} />{p.engagement?.comments ?? 0}</span>
                      <span className="flex items-center gap-0.5"><Share2 size={10} />{p.engagement?.shares ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Megaphone size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Published posts will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
