'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Plus, Pencil, Trash2, X, Copy, Eye, FileText, Search,
} from 'lucide-react'

interface Template {
  id: string
  name: string
  body: string
  category: string
}

const MERGE_FIELDS = ['{first_name}', '{company}', '{date}', '{amount}', '{link}']

const SAMPLE_DATA: Record<string, string> = {
  '{first_name}': 'Sarah',
  '{company}': 'Summit Capital',
  '{date}': 'May 20, 2026',
  '{amount}': '$2,500',
  '{link}': 'https://gravissmarketing.com/report',
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 't1',
    name: 'Appointment Reminder',
    body: 'Hi {first_name}, this is a reminder about your appointment on {date}. Reply YES to confirm or call us to reschedule.',
    category: 'Reminder',
  },
  {
    id: 't2',
    name: 'Follow Up',
    body: 'Hi {first_name}, just checking in on our conversation from last week. Do you have any questions about our proposal for {company}?',
    category: 'Sales',
  },
  {
    id: 't3',
    name: 'Review Request',
    body: 'Hi {first_name}, we hope you\'re enjoying our services at {company}! Would you mind leaving us a quick review? {link}',
    category: 'Marketing',
  },
  {
    id: 't4',
    name: 'Payment Reminder',
    body: 'Hi {first_name}, this is a friendly reminder that your payment of {amount} is due on {date}. Please reach out if you need assistance.',
    category: 'Billing',
  },
  {
    id: 't5',
    name: 'Thank You',
    body: 'Thank you {first_name}! We appreciate {company}\'s partnership. If there\'s anything we can help with, don\'t hesitate to reach out.',
    category: 'General',
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  Reminder: '#3b82f6',
  Sales: '#8b5cf6',
  Marketing: '#f59e0b',
  Billing: '#ef4444',
  General: '#6b7280',
}

function previewText(body: string): string {
  let result = body
  for (const [field, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(field, value)
  }
  return result
}

export default function SMSTemplatesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', body: '', category: 'General' })

  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.body.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    )
  }, [templates, search])

  function openCreate() {
    setForm({ name: '', body: '', category: 'General' })
    setCreating(true)
    setEditing(null)
  }

  function openEdit(t: Template) {
    setForm({ name: t.name, body: t.body, category: t.category })
    setEditing(t)
    setCreating(false)
  }

  function handleSave() {
    if (!form.name.trim() || !form.body.trim()) {
      toast('Name and body are required', 'error')
      return
    }
    if (editing) {
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...form } : t))
      setEditing(null)
      toast('Template updated', 'success')
    } else {
      const newTemplate: Template = { id: `t-${Date.now()}`, ...form }
      setTemplates(prev => [...prev, newTemplate])
      setCreating(false)
      toast('Template created', 'success')
    }
  }

  function handleDelete(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (editing?.id === id) setEditing(null)
    toast('Template deleted', 'success')
  }

  function handleUseTemplate(t: Template) {
    navigator.clipboard.writeText(t.body).then(() => {
      toast('Template copied! Navigate to messaging to paste.', 'success')
      router.push('/messaging')
    }).catch(() => {
      toast('Failed to copy template', 'error')
    })
  }

  function insertMergeField(field: string) {
    setForm(prev => ({ ...prev, body: prev.body + field }))
  }

  const isEditorOpen = creating || editing !== null

  return (
    <>
      <Header title="SMS Templates" subtitle="Pre-built message templates" />
      <div className="flex-1 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {/* Search + Create */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
              />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: '#015035' }}
            >
              <Plus size={15} />
              New Template
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Template List */}
            <div className="flex flex-col gap-3">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <FileText size={28} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No templates found</p>
                </div>
              ) : (
                filtered.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-gray-800 truncate">{t.name}</h3>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                            style={{ background: CATEGORY_COLORS[t.category] ?? '#6b7280' }}
                          >
                            {t.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{t.body}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                      <button
                        onClick={() => handleUseTemplate(t)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
                        style={{ background: '#015035' }}
                      >
                        <Copy size={12} />
                        Use Template
                      </button>
                      <button
                        onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-auto"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {previewId === t.id && (
                      <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview with sample data</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{previewText(t.body)}</p>
                        <p className={`text-[10px] mt-2 font-medium ${previewText(t.body).length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                          {previewText(t.body).length}/160 characters
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Editor Panel */}
            {isEditorOpen && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-800">
                    {editing ? 'Edit Template' : 'New Template'}
                  </h3>
                  <button
                    onClick={() => { setEditing(null); setCreating(false) }}
                    className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Template name"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                    >
                      {Object.keys(CATEGORY_COLORS).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message Body</label>
                    <textarea
                      value={form.body}
                      onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
                      placeholder="Type your template message..."
                      rows={5}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] font-medium ${form.body.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                        {form.body.length}/160 characters
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Merge Fields</label>
                    <div className="flex flex-wrap gap-1.5">
                      {MERGE_FIELDS.map(field => (
                        <button
                          key={field}
                          onClick={() => insertMergeField(field)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-green-700 transition-colors"
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.body && (
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Live Preview</p>
                      <p className="text-sm text-gray-800 leading-relaxed">{previewText(form.body)}</p>
                    </div>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={!form.name.trim() || !form.body.trim()}
                    className="w-full py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    {editing ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
