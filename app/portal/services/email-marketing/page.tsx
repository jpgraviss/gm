'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Mail, Send, Eye, MousePointer,
  Users, TrendingUp, Calendar, BarChart3,
} from 'lucide-react'

interface Broadcast {
  id: string
  name: string
  subject: string
  status: string
  sentAt?: string
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
}

interface EmailData {
  broadcasts: Broadcast[]
  totalSent: number
  avgOpenRate: number
  avgClickRate: number
  totalSubscribers: number
}

export default function PortalEmailMarketingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const [data, setData] = useState<EmailData>({
    broadcasts: [],
    totalSent: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    totalSubscribers: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!company) { requestAnimationFrame(() => setLoading(false)); return }
    fetch('/api/broadcasts?limit=20')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(result => {
        const broadcasts: Broadcast[] = (result.data ?? result ?? []).map((b: Record<string, unknown>) => ({
          id: b.id as string,
          name: b.name as string ?? '',
          subject: b.subject as string ?? '',
          status: b.status as string ?? 'draft',
          sentAt: b.sentAt as string ?? undefined,
          totalSent: (b.totalSent as number) ?? 0,
          totalDelivered: (b.totalDelivered as number) ?? 0,
          totalOpened: (b.totalOpened as number) ?? 0,
          totalClicked: (b.totalClicked as number) ?? 0,
          totalBounced: (b.totalBounced as number) ?? 0,
        }))
        const sent = broadcasts.filter(b => b.status === 'sent' || b.status === 'Sent')
        const totalSent = sent.reduce((s, b) => s + b.totalSent, 0)
        const totalOpened = sent.reduce((s, b) => s + b.totalOpened, 0)
        const totalClicked = sent.reduce((s, b) => s + b.totalClicked, 0)
        setData({
          broadcasts: sent,
          totalSent,
          avgOpenRate: totalSent > 0 ? totalOpened / totalSent : 0,
          avgClickRate: totalSent > 0 ? totalClicked / totalSent : 0,
          totalSubscribers: 0,
        })
      })
      .catch(() => toast('Failed to load email data', 'error'))
      .finally(() => setLoading(false))
  }, [company, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#0891b2' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal/services" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Services
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Email Marketing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Campaign performance and subscriber analytics</p>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Campaigns Sent', value: data.broadcasts.length.toString(), icon: Send, color: '#0891b2' },
            { label: 'Emails Delivered', value: data.totalSent.toLocaleString(), icon: Mail, color: '#015035' },
            { label: 'Avg. Open Rate', value: `${(data.avgOpenRate * 100).toFixed(1)}%`, icon: Eye, color: '#7c3aed' },
            { label: 'Avg. Click Rate', value: `${(data.avgClickRate * 100).toFixed(1)}%`, icon: MousePointer, color: '#ea580c' },
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
            <h3 className="text-sm font-semibold text-gray-800">Campaign Performance</h3>
          </div>
          {data.broadcasts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px]">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2.5 px-5 font-semibold">Campaign</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Sent</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Opens</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Open %</th>
                    <th className="text-right py-2.5 px-3 font-semibold">Clicks</th>
                    <th className="text-right py-2.5 px-4 font-semibold">Click %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.broadcasts.map(b => {
                    const openRate = b.totalSent > 0 ? (b.totalOpened / b.totalSent * 100).toFixed(1) : '0.0'
                    const clickRate = b.totalSent > 0 ? (b.totalClicked / b.totalSent * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-5">
                          <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{b.name || b.subject}</p>
                          {b.sentAt && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(b.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-gray-700">{b.totalSent.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-sm text-gray-700">{b.totalOpened.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-sm font-semibold" style={{ color: '#015035' }}>{openRate}%</td>
                        <td className="py-3 px-3 text-right text-sm text-gray-700">{b.totalClicked.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-sm font-semibold" style={{ color: '#0891b2' }}>{clickRate}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Mail size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Campaign data will appear here once emails are sent.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
