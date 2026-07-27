'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  Send, X, Plus, Mail, Clock, CheckCircle2, Eye,
  Star, ChevronLeft, Calendar, Users, FileText, AlertTriangle,
} from 'lucide-react'

type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'active' | 'failed'

interface Campaign {
  id: string
  workspace_id: string
  name: string
  template: string
  audience: string
  sent_count: number
  opened_count: number
  reviews_count: number
  status: CampaignStatus
  scheduled_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<CampaignStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft', icon: <FileText size={11} /> },
  scheduled: { bg: '#eff6ff', text: '#3b82f6', label: 'Scheduled', icon: <Clock size={11} /> },
  sent: { bg: '#f0fdf4', text: '#16a34a', label: 'Sent', icon: <CheckCircle2 size={11} /> },
  active: { bg: '#fefce8', text: '#ca8a04', label: 'Active', icon: <Send size={11} /> },
  // AUDIT — POST /api/reputation/requests previously marked every
  // just-dispatched campaign 'sent' even when the resolved audience was
  // empty or every send failed, showing a green "Sent" badge
  // indistinguishable from a real success with zero engagement yet.
  failed: { bg: '#fef2f2', text: '#dc2626', label: 'Failed to send', icon: <AlertTriangle size={11} /> },
}

const TEMPLATE_NAMES = ['Happy Client Follow-Up', 'Post-Project Review', 'Annual Check-In']

const AUDIENCE_OPTIONS = [
  'All Active Clients',
  'Web Design Clients',
  'SEO Clients',
  'PPC Clients',
  'Social Media Clients',
  'Clients 12+ Months',
  'New Clients (< 3 Months)',
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ReviewRequestsPage() {
  const { toast } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)

  const [formName, setFormName] = useState('')
  const [formTemplate, setFormTemplate] = useState(TEMPLATE_NAMES[0])
  const [formAudience, setFormAudience] = useState(AUDIENCE_OPTIONS[0])
  const [formSchedule, setFormSchedule] = useState(false)
  const [formScheduleDate, setFormScheduleDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/reputation/requests')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed')))
      .then((data) => {
        setCampaigns(data.campaigns)
        setTemplates(data.templates)
      })
      .catch(() => toast('Failed to load review campaigns', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!formName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/reputation/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          template: formTemplate,
          audience: formAudience,
          scheduled_at: formSchedule && formScheduleDate ? new Date(formScheduleDate).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create campaign', 'error')
        return
      }
      setCampaigns((prev) => [data, ...prev])
      setCreateOpen(false)
      resetForm()
      toast('Campaign created', 'success')
    } catch {
      toast('Failed to create campaign', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setFormName('')
    setFormTemplate(TEMPLATE_NAMES[0])
    setFormAudience(AUDIENCE_OPTIONS[0])
    setFormSchedule(false)
    setFormScheduleDate('')
  }

  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0)
  const totalOpened = campaigns.reduce((s, c) => s + c.opened_count, 0)
  const totalReviews = campaigns.reduce((s, c) => s + c.reviews_count, 0)

  return (
    <>
      <Header
        title="Review Campaigns"
        subtitle="Request and manage review campaigns"
        action={{ label: 'New Campaign', onClick: () => setCreateOpen(true) }}
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/reputation"
          className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: '#015035' }}
        >
          <ChevronLeft size={14} />
          Back to Reputation
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="metric-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#01503514', color: '#015035' }}>
              <Send size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900">{totalSent}</p>
            </div>
          </div>
          <div className="metric-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#3b82f614', color: '#3b82f6' }}>
              <Eye size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Total Opened</p>
              <p className="text-2xl font-bold text-gray-900">{totalOpened}</p>
              {totalSent > 0 && <p className="text-[11px] text-gray-400">{Math.round((totalOpened / totalSent) * 100)}% open rate</p>}
            </div>
          </div>
          <div className="metric-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b14', color: '#f59e0b' }}>
              <Star size={18} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Reviews Received</p>
              <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
              {totalSent > 0 && <p className="text-[11px] text-gray-400">{Math.round((totalReviews / totalSent) * 100)}% conversion</p>}
            </div>
          </div>
        </div>

        {/* Pre-built Templates */}
        <div className="metric-card">
          <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>
            Templates
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TEMPLATE_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => setPreviewTemplate(previewTemplate === name ? null : name)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  previewTemplate === name ? 'border-[#015035] bg-[#015035]/5' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={14} style={{ color: '#015035' }} />
                  <span className="text-xs font-semibold text-gray-900">{name}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                  {templates[name]?.split('\n').slice(0, 2).join(' ') || 'Loading...'}
                </p>
              </button>
            ))}
          </div>
          {previewTemplate && templates[previewTemplate] && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-700">Template Preview: {previewTemplate}</span>
                <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{templates[previewTemplate]}</pre>
            </div>
          )}
        </div>

        {/* Campaign History */}
        <div className="metric-card !p-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>
              Campaign History
            </h3>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              <Plus size={12} />
              New Campaign
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No campaigns yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {campaigns.map((campaign) => {
                const cfg = STATUS_CONFIG[campaign.status]
                const openRate = campaign.sent_count > 0 ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0
                return (
                  <div key={campaign.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{campaign.name}</span>
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: cfg.bg, color: cfg.text }}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <FileText size={10} />
                            {campaign.template}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={10} />
                            {campaign.audience}
                          </span>
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {formatDateTime(campaign.scheduled_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 overflow-x-auto">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{campaign.sent_count}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{campaign.opened_count}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Opened</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{campaign.reviews_count}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Reviews</p>
                        </div>
                        {campaign.sent_count > 0 && (
                          <div className="hidden sm:block">
                            <div className="w-16 h-16 relative">
                              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                                <circle
                                  cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
                                  strokeDasharray={`${openRate} ${100 - openRate}`}
                                  style={{ stroke: '#015035' }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-gray-700">{openRate}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-300 mt-2">Created {formatDate(campaign.created_at)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setCreateOpen(false); resetForm() }} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 sm:mx-auto shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest" style={{ fontFamily: 'var(--font-heading)' }}>
                  New Campaign
                </h2>
                <button onClick={() => { setCreateOpen(false); resetForm() }} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Q2 Client Satisfaction"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message Template</label>
                <select
                  value={formTemplate}
                  onChange={(e) => setFormTemplate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] bg-white"
                >
                  {TEMPLATE_NAMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target Audience</label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] bg-white"
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSchedule}
                    onChange={(e) => setFormSchedule(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#015035]"
                  />
                  <span className="text-xs font-semibold text-gray-600">Schedule for later</span>
                </label>
                {formSchedule && (
                  <input
                    type="datetime-local"
                    value={formScheduleDate}
                    onChange={(e) => setFormScheduleDate(e.target.value)}
                    className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                  />
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => { setCreateOpen(false); resetForm() }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !formName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#015035' }}
              >
                <Send size={13} />
                {submitting ? 'Creating...' : formSchedule ? 'Schedule Campaign' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
