'use client'

import { useState } from 'react'
import { X, FileText, Sparkles, Mail, Gift, UserPlus, Calendar, BarChart3, Star, MessageSquare } from 'lucide-react'
import { EMAIL_TEMPLATES, type EmailTemplate, type EmailBlock } from '@/lib/email-builder'

interface Props {
  onSelect: (blocks: EmailBlock[]) => void
  onClose: () => void
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  blank:        { label: 'Blank',        icon: <FileText size={14} />,      color: '#6b7280' },
  newsletter:   { label: 'Newsletter',   icon: <Mail size={14} />,          color: '#3b82f6' },
  announcement: { label: 'Announcement', icon: <Sparkles size={14} />,      color: '#8b5cf6' },
  promotion:    { label: 'Promotion',    icon: <Gift size={14} />,          color: '#ef4444' },
  welcome:      { label: 'Welcome',      icon: <UserPlus size={14} />,      color: '#22c55e' },
  'follow-up':  { label: 'Follow-Up',    icon: <MessageSquare size={14} />, color: '#f59e0b' },
  event:        { label: 'Event',        icon: <Calendar size={14} />,      color: '#06b6d4' },
}

export default function TemplatePicker({ onSelect, onClose }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? EMAIL_TEMPLATES
    : EMAIL_TEMPLATES.filter(t => t.category === filter)

  const categories = ['all', ...new Set(EMAIL_TEMPLATES.map(t => t.category))]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-900">Choose a Template</h3>
            <p className="text-xs text-gray-500 mt-0.5">Start with a pre-built design or blank canvas</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-1 px-5 py-3 border-b border-gray-50 overflow-x-auto flex-shrink-0">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat]
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 capitalize ${
                  filter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {meta?.icon} {cat === 'all' ? 'All Templates' : meta?.label ?? cat}
              </button>
            )
          })}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(template => (
              <TemplateCard key={template.id} template={template} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, onSelect }: { template: EmailTemplate; onSelect: (blocks: EmailBlock[]) => void }) {
  const meta = CATEGORY_META[template.category]

  return (
    <button
      onClick={() => onSelect(JSON.parse(JSON.stringify(template.blocks)))}
      className="group text-left border border-gray-200 rounded-xl overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all"
    >
      {/* Preview thumbnail */}
      <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100 group-hover:bg-emerald-50/30 transition-colors">
        {template.blocks.length === 0 ? (
          <div className="text-center">
            <FileText size={24} className="text-gray-300 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400">Blank canvas</p>
          </div>
        ) : (
          <div className="w-full h-full p-2 overflow-hidden">
            <div className="transform scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none">
              {template.blocks.slice(0, 3).map(b => (
                <div key={b.id} className="mb-1 text-[10px]" dangerouslySetInnerHTML={{ __html: `<div style="max-height:80px;overflow:hidden;">${b.type === 'header' ? `<div style="background:${b.content.bgColor};color:${b.content.textColor};padding:8px;font-size:10px;">${String(b.content.html ?? '').slice(0, 50)}</div>` : `<div style="padding:4px;font-size:8px;color:#666;">${String(b.content.html ?? b.content.text ?? b.type).slice(0, 60)}</div>`}</div>` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {meta && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${meta.color}15`, color: meta.color }}>
              {meta.label}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">{template.name}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{template.description}</p>
        <p className="text-[10px] text-gray-400 mt-1">{template.blocks.length} blocks</p>
      </div>
    </button>
  )
}
