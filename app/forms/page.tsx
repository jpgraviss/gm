'use client'

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Plus, X, Trash2, Copy, ExternalLink, FileText, Eye, Pencil,
  Type, Mail, Phone, AlignLeft, ListChecks, CheckSquare, Hash, Link2,
  GripVertical,
} from 'lucide-react'

interface FormField {
  id: string
  type: string
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  helpText?: string
  mapsTo?: string
}

interface LeadForm {
  id: string
  name: string
  slug: string
  description?: string
  fields: FormField[]
  submitLabel: string
  successMessage: string
  status: 'Active' | 'Paused' | 'Draft'
  submissionsCount: number
  primaryColor?: string
  textColor?: string
  bgColor?: string
  bgTransparent?: boolean
  fontFamily?: string
  createdAt: string
}

const FIELD_TYPES: Array<{ type: string; label: string; icon: React.ReactNode; mapsTo?: string }> = [
  { type: 'text',     label: 'Short text',  icon: <Type size={13} />, mapsTo: 'custom' },
  { type: 'email',    label: 'Email',       icon: <Mail size={13} />, mapsTo: 'email' },
  { type: 'phone',    label: 'Phone',       icon: <Phone size={13} />, mapsTo: 'phone' },
  { type: 'textarea', label: 'Long text',   icon: <AlignLeft size={13} />, mapsTo: 'notes' },
  { type: 'select',   label: 'Dropdown',    icon: <ListChecks size={13} /> },
  { type: 'checkbox', label: 'Checkbox',    icon: <CheckSquare size={13} /> },
  { type: 'number',   label: 'Number',      icon: <Hash size={13} /> },
  { type: 'url',      label: 'URL',         icon: <Link2 size={13} /> },
]

function newField(type: string, mapsTo?: string): FormField {
  const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  const defaults: Record<string, { label: string; name: string; placeholder?: string }> = {
    text:     { label: 'First name', name: 'first_name', placeholder: 'First name' },
    email:    { label: 'Email',      name: 'email',      placeholder: 'email@company.com' },
    phone:    { label: 'Phone',      name: 'phone',      placeholder: '(555) 123-4567' },
    textarea: { label: 'Message',    name: 'message',    placeholder: 'Tell us about your project…' },
    select:   { label: 'Budget',     name: 'budget' },
    checkbox: { label: 'I agree',    name: 'agree' },
    number:   { label: 'Number',     name: 'number' },
    url:      { label: 'Website',    name: 'website',    placeholder: 'https://…' },
  }
  const d = defaults[type] ?? { label: 'Field', name: 'field' }
  return { id, type, name: d.name, label: d.label, placeholder: d.placeholder, required: false, options: type === 'select' ? ['Option 1', 'Option 2'] : undefined, mapsTo }
}

export default function FormsPage() {
  const { toast } = useToast()
  const [forms, setForms] = useState<LeadForm[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LeadForm | null>(null)
  const [showEmbed, setShowEmbed] = useState<LeadForm | null>(null)

  useEffect(() => {
    fetch('/api/forms')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setForms(data) })
      .catch(() => toast('Failed to load forms', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormName, setNewFormName] = useState('')

  async function createForm(name: string) {
    if (!name.trim()) return
    setShowNewForm(false)
    setNewFormName('')
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fields: [
            newField('text', 'first_name'),
            newField('email', 'email'),
            newField('phone', 'phone'),
            newField('textarea', 'notes'),
          ],
        }),
      })
      if (!res.ok) { toast('Failed to create form', 'error'); return }
      const created = await res.json()
      setForms(prev => [created, ...prev])
      setSelected(created)
      toast('Form created', 'success')
    } catch {
      toast('Failed to create form', 'error')
    }
  }

  async function deleteForm(id: string) {
    if (!confirm('Delete this form? Submissions will be kept.')) return
    try {
      const res = await fetch(`/api/forms/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Failed to delete form', 'error'); return }
      setForms(prev => prev.filter(f => f.id !== id))
      if (selected?.id === id) setSelected(null)
      toast('Form deleted', 'success')
    } catch {
      toast('Failed to delete form', 'error')
    }
  }

  async function saveForm(form: LeadForm) {
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { toast('Failed to save', 'error'); return }
      const updated = await res.json()
      setForms(prev => prev.map(f => f.id === updated.id ? updated : f))
      setSelected(updated)
      toast('Saved', 'success')
    } catch {
      toast('Failed to save', 'error')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
  }

  return (
    <>
      <Header title="Forms" subtitle="Embeddable lead-capture forms" action={{ label: 'New Form', onClick: () => setShowNewForm(true) }} />
      <div className="page-content">
        {forms.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No forms yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Create a form and embed it on any website.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
              style={{ background: '#015035' }}
            >
              <Plus size={14} className="inline mr-1.5 -mt-0.5" /> New Form
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {forms.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                    <p className="text-xs text-gray-500">
                      {f.submissionsCount} submission{f.submissionsCount === 1 ? '' : 's'} · /{f.slug}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    f.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {f.status}
                  </span>
                  <button onClick={() => setShowEmbed(f)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Embed">
                    <Copy size={14} />
                  </button>
                  <a href={`/f/${f.slug}`} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Preview">
                    <Eye size={14} />
                  </a>
                  <button onClick={() => setSelected(f)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteForm(f.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <FormEditor
          form={selected}
          onClose={() => setSelected(null)}
          onSave={saveForm}
        />
      )}
      {showEmbed && (
        <EmbedModal form={showEmbed} onClose={() => setShowEmbed(null)} />
      )}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">New Form</h3>
              <p className="text-xs text-gray-500 mt-0.5">Give it a name — you can customize fields after.</p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Form name</label>
              <input
                autoFocus
                value={newFormName}
                onChange={e => setNewFormName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newFormName.trim()) createForm(newFormName.trim()) }}
                placeholder='e.g. "Contact Form", "Free Audit Request"'
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => createForm(newFormName.trim())}
                disabled={!newFormName.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                Create Form
              </button>
              <button
                onClick={() => { setShowNewForm(false); setNewFormName('') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FormEditor({ form, onClose, onSave }: { form: LeadForm; onClose: () => void; onSave: (f: LeadForm) => void }) {
  const [draft, setDraft] = useState<LeadForm>(form)

  function addField(type: string, mapsTo?: string) {
    setDraft(d => ({ ...d, fields: [...d.fields, newField(type, mapsTo)] }))
  }
  function removeField(id: string) {
    setDraft(d => ({ ...d, fields: d.fields.filter(f => f.id !== id) }))
  }
  function updateField(id: string, patch: Partial<FormField>) {
    setDraft(d => ({ ...d, fields: d.fields.map(f => f.id === id ? { ...f, ...patch } : f) }))
  }
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    setDraft(d => {
      const fields = [...d.fields]
      const [moved] = fields.splice(from, 1)
      fields.splice(to, 0, moved)
      return { ...d, fields }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(680px,100vw)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-sm">Edit Form</h2>
            <p className="text-white/60 text-xs">{draft.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/70" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Basics */}
          <section className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Form name</label>
              <input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                rows={2}
                value={draft.description ?? ''}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="Shown above the form on the public page"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </section>

          {/* Fields */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Fields</label>
              <span className="text-[11px] text-gray-400">{draft.fields.length} field{draft.fields.length === 1 ? '' : 's'}</span>
            </div>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="form-fields">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
                    {draft.fields.map((f, index) => (
                      <Draggable key={f.id} draggableId={f.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`p-3 border rounded-xl flex flex-col gap-2 ${snapshot.isDragging ? 'border-emerald-300 bg-emerald-50 shadow-lg' : 'border-gray-200 bg-gray-50/50'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div {...dragProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-gray-200 touch-none">
                                <GripVertical size={14} className="text-gray-400" />
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.type}</span>
                              <input
                                value={f.label}
                                onChange={e => updateField(f.id, { label: e.target.value })}
                                placeholder="Label"
                                className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <label className="flex items-center gap-1 text-[11px] text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={f.required ?? false}
                                  onChange={e => updateField(f.id, { required: e.target.checked })}
                                  className="w-3.5 h-3.5 rounded border-gray-300"
                                /> Required
                              </label>
                              <button onClick={() => removeField(f.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                <Trash2 size={12} />
                              </button>
                            </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={f.name}
                      onChange={e => updateField(f.id, { name: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
                      placeholder="field_name"
                      className="w-32 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-mono"
                    />
                    <input
                      value={f.placeholder ?? ''}
                      onChange={e => updateField(f.id, { placeholder: e.target.value })}
                      placeholder="Placeholder text"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                    />
                  </div>
                  {f.type === 'select' && (
                    <input
                      value={(f.options ?? []).join(', ')}
                      onChange={e => updateField(f.id, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                      placeholder="Option 1, Option 2, Option 3"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                    />
                  )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="mt-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Add field</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {FIELD_TYPES.map(t => (
                  <button
                    key={t.type}
                    onClick={() => addField(t.type, t.mapsTo)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Button + success */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Submit button label</label>
              <input
                value={draft.submitLabel}
                onChange={e => setDraft(d => ({ ...d, submitLabel: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select
                value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as LeadForm['status'] }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option>Active</option>
                <option>Paused</option>
                <option>Draft</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Success message</label>
              <input
                value={draft.successMessage}
                onChange={e => setDraft(d => ({ ...d, successMessage: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </section>

          {/* Styling */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Appearance</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Button color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.primaryColor ?? '#015035'} onChange={e => setDraft(d => ({ ...d, primaryColor: e.target.value }))} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
                  <input value={draft.primaryColor ?? '#015035'} onChange={e => setDraft(d => ({ ...d, primaryColor: e.target.value }))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Text color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.textColor ?? '#111827'} onChange={e => setDraft(d => ({ ...d, textColor: e.target.value }))} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
                  <input value={draft.textColor ?? '#111827'} onChange={e => setDraft(d => ({ ...d, textColor: e.target.value }))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Background</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.bgColor ?? '#f9fafb'} onChange={e => setDraft(d => ({ ...d, bgColor: e.target.value }))} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
                  <input value={draft.bgColor ?? '#f9fafb'} onChange={e => setDraft(d => ({ ...d, bgColor: e.target.value }))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Font</label>
                <select value={draft.fontFamily ?? 'system-ui'} onChange={e => setDraft(d => ({ ...d, fontFamily: e.target.value }))} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white">
                  <option value="system-ui">System (default)</option>
                  <option value="'Inter', sans-serif">Inter</option>
                  <option value="'Montserrat', sans-serif">Montserrat</option>
                  <option value="'Open Sans', sans-serif">Open Sans</option>
                  <option value="'Roboto', sans-serif">Roboto</option>
                  <option value="'Lato', sans-serif">Lato</option>
                  <option value="'Poppins', sans-serif">Poppins</option>
                  <option value="Georgia, serif">Georgia (serif)</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                <input type="checkbox" checked={draft.bgTransparent ?? false} onChange={e => setDraft(d => ({ ...d, bgTransparent: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-emerald-600" />
                <label className="text-xs text-gray-600">Transparent background (for embedding on colored pages)</label>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => onSave(draft)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Save Form
          </button>
          <a
            href={`/f/${draft.slug}`}
            target="_blank"
            rel="noopener"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> Preview
          </a>
        </div>
      </div>
    </div>
  )
}

function EmbedModal({ form, onClose }: { form: LeadForm; onClose: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.gravissmarketing.com'
  const iframeCode = `<iframe src="${appUrl}/f/${form.slug}" width="100%" height="600" style="border:none;border-radius:12px;" title="${form.name}"></iframe>`
  const scriptCode = `<div data-gravhub-form="${form.slug}"></div>\n<script src="${appUrl}/api/forms/public/${form.slug}/embed.js" async></script>`
  const directLink = `${appUrl}/f/${form.slug}`

  function copy(text: string) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Embed: {form.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Drop one of these into any website</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Direct link</label>
            <div className="flex gap-2">
              <input readOnly value={directLink} className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 font-mono" />
              <button onClick={() => copy(directLink)} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">Copy</button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Iframe (quick embed)</label>
            <textarea readOnly value={iframeCode} rows={3} className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 font-mono" />
            <button onClick={() => copy(iframeCode)} className="mt-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">Copy iframe</button>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">JavaScript (auto-resize)</label>
            <textarea readOnly value={scriptCode} rows={3} className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 font-mono" />
            <button onClick={() => copy(scriptCode)} className="mt-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">Copy script tag</button>
          </div>
        </div>
      </div>
    </div>
  )
}
