'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import {
  FileText, Plus, X, Trash2, Star, Copy, ChevronLeft, Loader2,
} from 'lucide-react'

interface DocumentTemplate {
  id: string
  name: string
  type: 'proposal' | 'contract' | 'addendum'
  body: string
  version: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

const TYPES: { value: DocumentTemplate['type']; label: string }[] = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'addendum', label: 'Addendum' },
]

const TYPE_COLORS: Record<DocumentTemplate['type'], string> = {
  proposal: 'bg-blue-100 text-blue-700',
  contract: 'bg-emerald-100 text-emerald-700',
  addendum: 'bg-amber-100 text-amber-700',
}

// The AI Assistant's generate_document tool and Apply Service Template
// automation action both fill these bracket tokens in from real
// deal/contract data — matches lib/automations-engine.ts's ai/chat
// generate_document implementation exactly, so a template author here can
// see what the AI-fill path will actually replace.
const KNOWN_PLACEHOLDERS = ['[CLIENT NAME]', '[DATE]', '[COMPANY]', '[AMOUNT]', '[SERVICE]']

function EditorPanel({
  template,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  // A draft (new or duplicated-as-new) template has id === '' — used to
  // distinguish "create" from "edit" without a separate sentinel value.
  template: DocumentTemplate
  onClose: () => void
  onSave: (data: { name: string; type: string; body: string; isDefault: boolean }, id?: string) => void
  onDelete: (id: string) => void
  saving: boolean
}) {
  const isNew = template.id === ''
  const [name, setName] = useState(template.name)
  const [type, setType] = useState<DocumentTemplate['type']>(template.type)
  const [body, setBody] = useState(template.body)
  const [isDefault, setIsDefault] = useState(template.isDefault)

  const canSave = name.trim().length > 0 && body.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-sm font-bold text-gray-900">
              {isNew ? 'New Template' : 'Edit Template'}
            </h2>
          </div>
          {!isNew && (
            <button
              onClick={() => onDelete(template.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              title="Delete template"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Standard Service Agreement"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as DocumentTemplate['type'])}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Default for this type
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Placeholder tokens</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Bracket tokens like <code className="bg-white px-1 rounded border border-gray-200">[CLIENT NAME]</code> get filled in automatically when a document is generated from this template. Any <code className="bg-white px-1 rounded border border-gray-200">[TOKEN]</code> works — the ones already wired to real data are:{' '}
              {KNOWN_PLACEHOLDERS.map(p => <code key={p} className="bg-white px-1 rounded border border-gray-200 mr-1">{p}</code>)}
            </p>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Full template text with [PLACEHOLDER] tokens..."
              className="w-full flex-1 min-h-[320px] text-sm font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-100 flex gap-2">
          <button
            disabled={!canSave || saving}
            onClick={() => onSave({ name: name.trim(), type, body, isDefault }, template?.id)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {template ? 'Save Changes' : 'Create Template'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentTemplatesPage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<DocumentTemplate | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | DocumentTemplate['type']>('all')

  useEffect(() => {
    fetch('/api/document-templates')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setTemplates(data) })
      .catch(() => toast('Failed to load templates', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = useMemo(
    () => typeFilter === 'all' ? templates : templates.filter(t => t.type === typeFilter),
    [templates, typeFilter],
  )

  async function handleSave(data: { name: string; type: string; body: string; isDefault: boolean }, id?: string) {
    setSaving(true)
    try {
      const res = await fetch(id ? `/api/document-templates/${id}` : '/api/document-templates', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? data : { name: data.name, type: data.type, body: data.body, isDefault: data.isDefault }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast(err.error || 'Failed to save template', 'error')
        return
      }
      const saved = await res.json()
      setTemplates(prev => {
        // Setting a new default clears is_default on siblings of the same
        // type server-side — mirror that locally so the badge doesn't lag
        // until the next full reload.
        const next = id
          ? prev.map(t => t.id === id ? saved : t)
          : [saved, ...prev]
        return data.isDefault
          ? next.map(t => t.id === saved.id ? t : (t.type === saved.type ? { ...t, isDefault: false } : t))
          : next
      })
      toast(id ? 'Template updated' : 'Template created', 'success')
      setEditing(null)
    } catch {
      toast('Failed to save template', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    const removed = templates.find(t => t.id === id)
    const removedIndex = templates.findIndex(t => t.id === id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setEditing(null)
    try {
      const res = await fetch(`/api/document-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (removed) setTemplates(prev => [...prev.slice(0, removedIndex), removed, ...prev.slice(removedIndex)])
        toast(err.error || 'Failed to delete template', 'error')
        return
      }
      toast('Template deleted', 'success')
    } catch {
      if (removed) setTemplates(prev => [...prev.slice(0, removedIndex), removed, ...prev.slice(removedIndex)])
      toast('Failed to delete template', 'error')
    }
  }

  function duplicateAsNew(t: DocumentTemplate) {
    setEditing({ ...t, id: '', name: `${t.name} (Copy)`, isDefault: false })
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Document Templates" subtitle="Reusable proposal, contract, and addendum templates" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            {(['all', ...TYPES.map(t => t.value)] as const).map(v => (
              <button
                key={v}
                onClick={() => setTypeFilter(v)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
                  typeFilter === v ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v === 'all' ? 'All' : TYPES.find(t => t.value === v)?.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setEditing({
              id: '', name: '', type: typeFilter === 'all' ? 'proposal' : typeFilter, body: '',
              version: 1, isDefault: false, createdAt: '', updatedAt: '',
            })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#015035' }}
          >
            <Plus size={15} /> New Template
          </button>
        </div>

        {loading ? (
          <LoadingScreen />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <FileText size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No templates yet</p>
            <p className="text-xs text-gray-400 mt-1">Create one to power the AI Assistant&apos;s document generation and the Apply Service Template automation action</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(t => (
              <div
                key={t.id}
                onClick={() => setEditing(t)}
                className="bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${TYPE_COLORS[t.type]}`}>
                    {t.type}
                  </span>
                  <div className="flex items-center gap-1">
                    {t.isDefault && (
                      <span title="Default template for this type">
                        <Star size={13} className="text-amber-400 fill-amber-400" />
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); duplicateAsNew(t) }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-opacity"
                      title="Duplicate as new template"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900 truncate mb-1">{t.name}</p>
                <p className="text-xs text-gray-400">v{t.version} &middot; {t.body.length.toLocaleString()} chars</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditorPanel
          template={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
        />
      )}
    </div>
  )
}
