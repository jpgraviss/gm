'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  ArrowLeft, PenTool, FileText, Calendar, CheckCircle,
  Circle, Clock, Eye, TrendingUp,
} from 'lucide-react'

interface ContentPiece {
  id: string
  title: string
  type: string
  status: string
  publishDate?: string
  wordCount?: number
  views?: number
}

interface ContentData {
  pieces: ContentPiece[]
  totalPublished: number
  totalInProgress: number
  totalWords: number
}

export default function PortalContentCreationPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<ContentData>({
    pieces: [],
    totalPublished: 0,
    totalInProgress: 0,
    totalWords: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch(`/api/portal/seo?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const contentConfig = d?.strategy?.content ?? null
        if (contentConfig) {
          const pieces: ContentPiece[] = contentConfig.pieces ?? []
          setData({
            pieces,
            totalPublished: pieces.filter((p: ContentPiece) => p.status === 'Published').length,
            totalInProgress: pieces.filter((p: ContentPiece) => p.status === 'In Progress' || p.status === 'Draft').length,
            totalWords: pieces.reduce((s: number, p: ContentPiece) => s + (p.wordCount ?? 0), 0),
          })
        }
      })
      .catch(() => toast('Failed to load content data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Content Creation</h1>
          <p className="text-xs text-gray-500 mt-0.5">Content calendar, published pieces, and performance</p>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Published', value: data.totalPublished.toString(), icon: CheckCircle, color: '#015035' },
            { label: 'In Progress', value: data.totalInProgress.toString(), icon: Clock, color: '#ea580c' },
            { label: 'Total Pieces', value: data.pieces.length.toString(), icon: FileText, color: '#2563eb' },
            { label: 'Total Words', value: data.totalWords.toLocaleString(), icon: PenTool, color: '#7c3aed' },
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Content Calendar</h3>
          </div>
          {data.pieces.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {data.pieces.map(p => (
                <div key={p.id} className="px-5 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3">
                  {p.status === 'Published' ? (
                    <CheckCircle size={14} style={{ color: '#015035' }} className="flex-shrink-0" />
                  ) : (
                    <Circle size={14} className="text-gray-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">{p.type}</span>
                      {p.wordCount && <span className="text-[10px] text-gray-400">{p.wordCount.toLocaleString()} words</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'Published' ? 'bg-emerald-100 text-emerald-700' :
                      p.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status}
                    </span>
                    {p.publishDate && (
                      <span className="text-[11px] text-gray-400">
                        {new Date(p.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <PenTool size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Content pieces will appear here once created.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
