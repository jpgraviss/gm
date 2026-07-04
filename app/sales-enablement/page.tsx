'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import {
  BookOpen, FileText, Plus, X, Trash2, Tag, Eye, ChevronLeft, Copy,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────────

type PlaybookCategory = 'Sales Script' | 'Objection Handler' | 'Pitch Framework' | 'Process' | 'Other'
type TemplateCategory = 'Email' | 'Pitch Deck' | 'Proposal' | 'Contract' | 'Other'

interface Playbook {
  id: string
  title: string
  category: PlaybookCategory | string
  content: string
  tags: string[]
  status: string
  createdAt: string
  updatedAt: string
}

interface SalesTemplate {
  id: string
  title: string
  category: TemplateCategory | string
  content: string
  subject: string
  tags: string[]
  usageCount: number
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const playbookCategories: PlaybookCategory[] = ['Sales Script', 'Objection Handler', 'Pitch Framework', 'Process', 'Other']
const templateCategories: TemplateCategory[] = ['Email', 'Pitch Deck', 'Proposal', 'Contract', 'Other']

const playbookCategoryColors: Record<string, string> = {
  'Sales Script':      'bg-blue-100 text-blue-700',
  'Objection Handler': 'bg-orange-100 text-orange-700',
  'Pitch Framework':   'bg-purple-100 text-purple-700',
  'Process':           'bg-emerald-100 text-emerald-700',
  'Other':             'bg-gray-100 text-gray-600',
}

const templateCategoryColors: Record<string, string> = {
  'Email':      'bg-blue-100 text-blue-700',
  'Pitch Deck': 'bg-indigo-100 text-indigo-700',
  'Proposal':   'bg-emerald-100 text-emerald-700',
  'Contract':   'bg-amber-100 text-amber-700',
  'Other':      'bg-gray-100 text-gray-600',
}

// ─── Playbook Panel ─────────────────────────────────────────────────────────────

function PlaybookPanel({
  playbook,
  onClose,
  onSave,
  onDelete,
}: {
  playbook: Playbook | null
  onClose: () => void
  onSave: (data: { title: string; category: PlaybookCategory; content: string; tags: string[] }, id?: string) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(playbook?.title ?? '')
  const [category, setCategory] = useState<PlaybookCategory>((playbook?.category as PlaybookCategory) ?? 'Sales Script')
  const [content, setContent] = useState(playbook?.content ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(playbook?.tags ?? [])

  const canSave = title.trim().length > 0

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
              {playbook ? 'Edit Playbook' : 'New Playbook'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5">Sales enablement playbook</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Cold Call Opening Script"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as PlaybookCategory)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {playbookCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your playbook content here (supports markdown-like formatting)..."
              rows={14}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
              />
              <button onClick={addTag} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                <Plus size={14} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    <Tag size={10} />
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onSave({ title: title.trim(), category, content, tags }, playbook?.id)}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            {playbook ? 'Save Changes' : 'Create Playbook'}
          </button>
          {playbook && (
            <button onClick={() => onDelete(playbook.id)} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template Panel ─────────────────────────────────────────────────────────────

function TemplatePanel({
  template,
  onClose,
  onSave,
  onDelete,
}: {
  template: SalesTemplate | null
  onClose: () => void
  onSave: (data: { title: string; category: TemplateCategory; subject: string; content: string; tags: string[] }, id?: string) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(template?.title ?? '')
  const [category, setCategory] = useState<TemplateCategory>((template?.category as TemplateCategory) ?? 'Email')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [content, setContent] = useState(template?.content ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(template?.tags ?? [])

  const canSave = title.trim().length > 0

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-heading)' }}>
              {template ? 'Edit Template' : 'New Template'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5">Sales template for outreach</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Initial Outreach Email"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as TemplateCategory)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {templateCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject Line</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Quick question about your marketing strategy"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your template content..."
              rows={12}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
              />
              <button onClick={addTag} className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                <Plus size={14} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    <Tag size={10} />
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onSave({ title: title.trim(), category, subject, content, tags }, template?.id)}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            {template ? 'Save Changes' : 'Create Template'}
          </button>
          {template && (
            <button onClick={() => onDelete(template.id)} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SalesEnablementPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'playbooks' | 'templates'>('playbooks')

  // Playbooks state
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(true)
  const [playbookPanel, setPlaybookPanel] = useState<{ open: boolean; playbook: Playbook | null }>({ open: false, playbook: null })
  const [playbookCategoryFilter, setPlaybookCategoryFilter] = useState<string>('All')

  // Templates state
  const [templates, setTemplates] = useState<SalesTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [templatePanel, setTemplatePanel] = useState<{ open: boolean; template: SalesTemplate | null }>({ open: false, template: null })
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('All')

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchPlaybooks()
    fetchTemplates()
  }, [])

  async function fetchPlaybooks() {
    try {
      const res = await fetch('/api/playbooks?limit=200')
      if (!res.ok) throw new Error('Failed to fetch playbooks')
      const json = await res.json()
      setPlaybooks(json.data ?? [])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingPlaybooks(false)
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/sales-templates?limit=200')
      if (!res.ok) throw new Error('Failed to fetch templates')
      const json = await res.json()
      setTemplates(json.data ?? [])
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoadingTemplates(false)
    }
  }

  // ─── Playbook CRUD ─────────────────────────────────────────────────────────

  async function savePlaybook(data: { title: string; category: string; content: string; tags: string[] }, id?: string) {
    try {
      if (id) {
        const res = await fetch(`/api/playbooks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to update playbook')
        const updated = await res.json()
        setPlaybooks(prev => prev.map(p => (p.id === id ? updated : p)))
        toast('Playbook updated', 'success')
      } else {
        const res = await fetch('/api/playbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to create playbook')
        const created = await res.json()
        setPlaybooks(prev => [created, ...prev])
        toast('Playbook created', 'success')
      }
      setPlaybookPanel({ open: false, playbook: null })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function deletePlaybook(id: string) {
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete playbook')
      setPlaybooks(prev => prev.filter(p => p.id !== id))
      setPlaybookPanel({ open: false, playbook: null })
      toast('Playbook deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  // ─── Template CRUD ─────────────────────────────────────────────────────────

  async function saveTemplate(data: { title: string; category: string; subject: string; content: string; tags: string[] }, id?: string) {
    try {
      if (id) {
        const res = await fetch(`/api/sales-templates/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to update template')
        const updated = await res.json()
        setTemplates(prev => prev.map(t => (t.id === id ? updated : t)))
        toast('Template updated', 'success')
      } else {
        const res = await fetch('/api/sales-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to create template')
        const created = await res.json()
        setTemplates(prev => [created, ...prev])
        toast('Template created', 'success')
      }
      setTemplatePanel({ open: false, template: null })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function deleteTemplate(id: string) {
    try {
      const res = await fetch(`/api/sales-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
      setTemplates(prev => prev.filter(t => t.id !== id))
      setTemplatePanel({ open: false, template: null })
      toast('Template deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function applyTemplate(tmpl: SalesTemplate) {
    try {
      await navigator.clipboard.writeText(tmpl.content)
      const res = await fetch(`/api/sales-templates/${tmpl.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usageCount: tmpl.usageCount + 1 }),
      })
      if (!res.ok) throw new Error('Failed to track template usage')
      const updated = await res.json()
      setTemplates(prev => prev.map(t => (t.id === tmpl.id ? updated : t)))
      toast('Template copied to clipboard', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  // ─── Filtered data ─────────────────────────────────────────────────────────

  const filteredPlaybooks = playbookCategoryFilter === 'All'
    ? playbooks
    : playbooks.filter(p => p.category === playbookCategoryFilter)

  const filteredTemplates = templateCategoryFilter === 'All'
    ? templates
    : templates.filter(t => t.category === templateCategoryFilter)

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="Sales Enablement"
        subtitle="Playbooks, templates, and sales collateral"
        action={
          activeTab === 'playbooks'
            ? { label: 'New Playbook', onClick: () => setPlaybookPanel({ open: true, playbook: null }) }
            : { label: 'New Template', onClick: () => setTemplatePanel({ open: true, template: null }) }
        }
      />

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('playbooks')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'playbooks'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen size={14} className="inline mr-1.5 -mt-0.5" />
            Playbooks
            <span className="ml-1.5 text-xs text-gray-400">({playbooks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={14} className="inline mr-1.5 -mt-0.5" />
            Templates
            <span className="ml-1.5 text-xs text-gray-400">({templates.length})</span>
          </button>
        </div>

        {/* ── Playbooks Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'playbooks' && (
          <>
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
              {['All', ...playbookCategories].map(cat => (
                <button
                  key={cat}
                  onClick={() => setPlaybookCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    playbookCategoryFilter === cat
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={playbookCategoryFilter === cat ? { background: '#015035' } : undefined}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingPlaybooks ? (
              <div className="text-center py-20 text-gray-400 text-sm">Loading playbooks...</div>
            ) : filteredPlaybooks.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No playbooks yet</p>
                <button
                  onClick={() => setPlaybookPanel({ open: true, playbook: null })}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> Create Playbook
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPlaybooks.map(pb => (
                  <button
                    key={pb.id}
                    onClick={() => setPlaybookPanel({ open: true, playbook: pb })}
                    className="text-left bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-gray-300 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-1">{pb.title}</h3>
                      <Eye size={14} className="text-gray-300 group-hover:text-emerald-500 flex-shrink-0 mt-0.5" />
                    </div>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide mb-2 ${playbookCategoryColors[pb.category] ?? playbookCategoryColors['Other']}`}>
                      {pb.category}
                    </span>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {pb.content ? pb.content.slice(0, 100) + (pb.content.length > 100 ? '...' : '') : 'No content yet'}
                    </p>
                    {pb.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pb.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            <Tag size={8} />
                            {tag}
                          </span>
                        ))}
                        {pb.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{pb.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Templates Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <>
            {/* Category filter pills */}
            <div className="flex flex-wrap gap-2">
              {['All', ...templateCategories].map(cat => (
                <button
                  key={cat}
                  onClick={() => setTemplateCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    templateCategoryFilter === cat
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={templateCategoryFilter === cat ? { background: '#015035' } : undefined}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loadingTemplates ? (
              <div className="text-center py-20 text-gray-400 text-sm">Loading templates...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-20">
                <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No templates yet</p>
                <button
                  onClick={() => setTemplatePanel({ open: true, template: null })}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> Create Template
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map(tmpl => (
                  <div
                    key={tmpl.id}
                    className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-gray-300 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={() => setTemplatePanel({ open: true, template: tmpl })}
                        className="text-left flex-1"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 line-clamp-1">{tmpl.title}</h3>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${templateCategoryColors[tmpl.category] ?? templateCategoryColors['Other']}`}>
                        {tmpl.category}
                      </span>
                      <span className="text-[10px] text-gray-400">{tmpl.usageCount} uses</span>
                    </div>
                    {tmpl.subject && (
                      <p className="text-xs text-gray-500 mb-1 truncate">
                        <span className="font-medium text-gray-600">Subject:</span> {tmpl.subject}
                      </p>
                    )}
                    {tmpl.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tmpl.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            <Tag size={8} />
                            {tag}
                          </span>
                        ))}
                        {tmpl.tags.length > 3 && (
                          <span className="text-[10px] text-gray-400">+{tmpl.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => applyTemplate(tmpl)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                        style={{ background: '#015035' }}
                      >
                        <Copy size={11} /> Use Template
                      </button>
                      <button
                        onClick={() => setTemplatePanel({ open: true, template: tmpl })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Panels */}
      {playbookPanel.open && (
        <PlaybookPanel
          playbook={playbookPanel.playbook}
          onClose={() => setPlaybookPanel({ open: false, playbook: null })}
          onSave={savePlaybook}
          onDelete={deletePlaybook}
        />
      )}
      {templatePanel.open && (
        <TemplatePanel
          template={templatePanel.template}
          onClose={() => setTemplatePanel({ open: false, template: null })}
          onSave={saveTemplate}
          onDelete={deleteTemplate}
        />
      )}
    </>
  )
}
