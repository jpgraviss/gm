'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import {
  BookOpen, FileText, Plus, X, Trash2, Tag, Eye, ChevronLeft, Copy,
  ChevronDown, ChevronRight, ChevronUp, GraduationCap, Video,
  CheckSquare, HelpCircle, Pencil, Layers,
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

// ─── Training Module Types ──────────────────────────────────────────────────────

type ContentType = 'text' | 'video' | 'checklist' | 'quiz'

interface ChecklistItem {
  id: string
  label: string
}

interface QuizQuestion {
  id: string
  question: string
  answer: string
}

interface TrainingContentItem {
  id: string
  title: string
  type: ContentType
  body?: string
  embedUrl?: string
  items?: ChecklistItem[]
  questions?: QuizQuestion[]
}

interface TrainingChapter {
  id: string
  title: string
  content: TrainingContentItem[]
}

interface TrainingModule {
  id: string
  title: string
  description: string
  chapters: TrainingChapter[]
}

type EditTarget =
  | { kind: 'module'; module: TrainingModule | null }
  | { kind: 'chapter'; moduleId: string; chapter: TrainingChapter | null }
  | { kind: 'content'; moduleId: string; chapterId: string; content: TrainingContentItem | null }

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

const CONTENT_TYPE_ICONS: Record<ContentType, React.ReactNode> = {
  text:      <FileText size={14} className="text-blue-500" />,
  video:     <Video size={14} className="text-purple-500" />,
  checklist: <CheckSquare size={14} className="text-emerald-500" />,
  quiz:      <HelpCircle size={14} className="text-amber-500" />,
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function genId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function moveItem<T>(arr: T[], index: number, direction: 'up' | 'down'): T[] {
  const copy = [...arr]
  const swap = direction === 'up' ? index - 1 : index + 1
  if (swap < 0 || swap >= copy.length) return copy
  ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  return copy
}

// ─── Training Panel ─────────────────────────────────────────────────────────────

function TrainingPanel({
  target,
  onClose,
  onSave,
}: {
  target: EditTarget
  onClose: () => void
  onSave: (target: EditTarget, data: Record<string, unknown>) => void
}) {
  const isModule = target.kind === 'module'
  const isChapter = target.kind === 'chapter'
  const isContent = target.kind === 'content'

  const existing = isModule ? target.module : isChapter ? target.chapter : target.content

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(isModule ? (target.module?.description ?? '') : '')
  const [contentType, setContentType] = useState<ContentType>(isContent ? (target.content?.type ?? 'text') : 'text')
  const [body, setBody] = useState(isContent ? (target.content?.body ?? '') : '')
  const [embedUrl, setEmbedUrl] = useState(isContent ? (target.content?.embedUrl ?? '') : '')
  const [items, setItems] = useState<ChecklistItem[]>(isContent ? (target.content?.items ?? []) : [])
  const [questions, setQuestions] = useState<QuizQuestion[]>(isContent ? (target.content?.questions ?? []) : [])

  const canSave = title.trim().length > 0

  function handleSave() {
    const data: Record<string, unknown> = { title: title.trim() }
    if (isModule) data.description = description
    if (isContent) {
      data.type = contentType
      if (contentType === 'text') data.body = body
      if (contentType === 'video') data.embedUrl = embedUrl
      if (contentType === 'checklist') data.items = items.filter(i => i.label.trim())
      if (contentType === 'quiz') data.questions = questions.filter(q => q.question.trim())
    }
    onSave(target, data)
  }

  const heading = isModule
    ? (target.module ? 'Edit Module' : 'New Module')
    : isChapter
      ? (target.chapter ? 'Edit Chapter' : 'New Chapter')
      : (target.content ? 'Edit Content' : 'New Content')

  const subtitle = isModule ? 'Training module' : isChapter ? 'Chapter within module' : 'Lesson or resource'

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(480px, 100vw)' }}>

        <div className="p-5 flex items-start justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-heading)' }}>{heading}</h2>
            <p className="text-white/50 text-xs mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              placeholder={isModule ? 'e.g. Sales Fundamentals' : isChapter ? 'e.g. Introduction' : 'e.g. Cold Call Opening'}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>

          {/* Description (module only) */}
          {isModule && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Module description..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
              />
            </div>
          )}

          {/* Content-type-specific fields */}
          {isContent && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content Type</label>
                <select
                  value={contentType}
                  onChange={e => setContentType(e.target.value as ContentType)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="checklist">Checklist</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>

              {contentType === 'text' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Body</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your content here..."
                    rows={14}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none font-mono"
                  />
                </div>
              )}

              {contentType === 'video' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Embed URL</label>
                  <input
                    value={embedUrl}
                    onChange={e => setEmbedUrl(e.target.value)}
                    placeholder="https://www.youtube.com/embed/..."
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                  />
                  {embedUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
                      <iframe src={embedUrl} className="w-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  )}
                </div>
              )}

              {contentType === 'checklist' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Checklist Items</label>
                  <div className="flex flex-col gap-2">
                    {items.map((item, i) => (
                      <div key={item.id} className="flex gap-2 items-center">
                        <input
                          value={item.label}
                          onChange={e => {
                            const copy = [...items]
                            copy[i] = { ...copy[i], label: e.target.value }
                            setItems(copy)
                          }}
                          placeholder="Item label..."
                          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                        />
                        <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setItems([...items, { id: genId(), label: '' }])}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </div>
                </div>
              )}

              {contentType === 'quiz' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Questions</label>
                  <div className="flex flex-col gap-3">
                    {questions.map((q, i) => (
                      <div key={q.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2 items-start">
                          <span className="text-xs font-semibold text-gray-400 mt-2">Q{i + 1}</span>
                          <input
                            value={q.question}
                            onChange={e => {
                              const copy = [...questions]
                              copy[i] = { ...copy[i], question: e.target.value }
                              setQuestions(copy)
                            }}
                            placeholder="Question..."
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                          />
                          <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea
                          value={q.answer}
                          onChange={e => {
                            const copy = [...questions]
                            copy[i] = { ...copy[i], answer: e.target.value }
                            setQuestions(copy)
                          }}
                          placeholder="Answer..."
                          rows={2}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setQuestions([...questions, { id: genId(), question: '', answer: '' }])}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Question
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            {existing ? 'Save Changes' : `Create ${isModule ? 'Module' : isChapter ? 'Chapter' : 'Content'}`}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
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
  const [activeTab, setActiveTab] = useState<'modules' | 'playbooks' | 'templates'>('modules')

  // ─── Training Modules State ──────────────────────────────────────────────────
  const [modules, setModules] = useState<TrainingModule[]>([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set())
  const [completion, setCompletion] = useState<Record<string, boolean>>({})
  const [checklistState, setChecklistState] = useState<Record<string, Record<string, boolean>>>({})
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set())
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)

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
    fetchModules()
    fetchPlaybooks()
    fetchTemplates()
    // Load completion state from localStorage
    try {
      const stored = localStorage.getItem('training_completion')
      if (stored) setCompletion(JSON.parse(stored))
      const clStored = localStorage.getItem('training_checklist_state')
      if (clStored) setChecklistState(JSON.parse(clStored))
    } catch { /* ignore parse errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchModules() {
    try {
      const res = await fetch('/api/training')
      if (!res.ok) throw new Error('Failed to fetch training modules')
      const json = await res.json()
      setModules(json.modules ?? [])
    } catch (e) {
      console.error('[fetchModules]', e)
      // Don't toast on initial load failure — column may not exist yet
    } finally {
      setLoadingModules(false)
    }
  }

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

  // ─── Training Module CRUD ─────────────────────────────────────────────────

  async function persistModules(updated: TrainingModule[]) {
    const res = await fetch('/api/training', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: updated }),
    })
    if (!res.ok) throw new Error('Failed to save training modules')
    setModules(updated)
  }

  async function handleTrainingSave(target: EditTarget, data: Record<string, unknown>) {
    let updated: TrainingModule[] = modules

    if (target.kind === 'module') {
      if (target.module) {
        updated = modules.map(m =>
          m.id === target.module!.id
            ? { ...m, title: data.title as string, description: (data.description as string) ?? '' }
            : m,
        )
      } else {
        updated = [...modules, {
          id: genId(),
          title: data.title as string,
          description: (data.description as string) ?? '',
          chapters: [],
        }]
      }
    } else if (target.kind === 'chapter') {
      if (target.chapter) {
        updated = modules.map(m =>
          m.id === target.moduleId
            ? { ...m, chapters: m.chapters.map(ch => ch.id === target.chapter!.id ? { ...ch, title: data.title as string } : ch) }
            : m,
        )
      } else {
        const newCh: TrainingChapter = { id: genId(), title: data.title as string, content: [] }
        updated = modules.map(m =>
          m.id === target.moduleId ? { ...m, chapters: [...m.chapters, newCh] } : m,
        )
      }
    } else {
      // content
      const buildContent = (id: string): TrainingContentItem => ({
        id,
        title: data.title as string,
        type: (data.type as ContentType) ?? 'text',
        body: data.type === 'text' ? (data.body as string) : undefined,
        embedUrl: data.type === 'video' ? (data.embedUrl as string) : undefined,
        items: data.type === 'checklist' ? (data.items as ChecklistItem[]) : undefined,
        questions: data.type === 'quiz' ? (data.questions as QuizQuestion[]) : undefined,
      })

      if (target.content) {
        updated = modules.map(m =>
          m.id === target.moduleId
            ? {
                ...m,
                chapters: m.chapters.map(ch =>
                  ch.id === target.chapterId
                    ? { ...ch, content: ch.content.map(c => c.id === target.content!.id ? buildContent(c.id) : c) }
                    : ch,
                ),
              }
            : m,
        )
      } else {
        const newContent = buildContent(genId())
        updated = modules.map(m =>
          m.id === target.moduleId
            ? {
                ...m,
                chapters: m.chapters.map(ch =>
                  ch.id === target.chapterId
                    ? { ...ch, content: [...ch.content, newContent] }
                    : ch,
                ),
              }
            : m,
        )
      }
    }

    try {
      await persistModules(updated)
      const label = target.kind === 'module' ? 'Module' : target.kind === 'chapter' ? 'Chapter' : 'Content'
      const action = (target.kind === 'module' ? target.module : target.kind === 'chapter' ? target.chapter : target.content) ? 'updated' : 'created'
      toast(`${label} ${action}`, 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    setEditTarget(null)
  }

  async function deleteModule(id: string) {
    try {
      await persistModules(modules.filter(m => m.id !== id))
      toast('Module deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function deleteChapter(moduleId: string, chapterId: string) {
    try {
      await persistModules(modules.map(m =>
        m.id === moduleId ? { ...m, chapters: m.chapters.filter(ch => ch.id !== chapterId) } : m,
      ))
      toast('Chapter deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function deleteContent(moduleId: string, chapterId: string, contentId: string) {
    try {
      await persistModules(modules.map(m =>
        m.id === moduleId
          ? { ...m, chapters: m.chapters.map(ch => ch.id === chapterId ? { ...ch, content: ch.content.filter(c => c.id !== contentId) } : ch) }
          : m,
      ))
      toast('Content deleted', 'success')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function handleMoveModule(index: number, direction: 'up' | 'down') {
    try {
      await persistModules(moveItem(modules, index, direction))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function handleMoveChapter(moduleId: string, index: number, direction: 'up' | 'down') {
    try {
      await persistModules(modules.map(m =>
        m.id === moduleId ? { ...m, chapters: moveItem(m.chapters, index, direction) } : m,
      ))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function handleMoveContent(moduleId: string, chapterId: string, index: number, direction: 'up' | 'down') {
    try {
      await persistModules(modules.map(m =>
        m.id === moduleId
          ? { ...m, chapters: m.chapters.map(ch => ch.id === chapterId ? { ...ch, content: moveItem(ch.content, index, direction) } : ch) }
          : m,
      ))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  // ─── Completion Tracking ──────────────────────────────────────────────────

  function toggleCompletion(contentId: string) {
    setCompletion(prev => {
      const next = { ...prev, [contentId]: !prev[contentId] }
      localStorage.setItem('training_completion', JSON.stringify(next))
      return next
    })
  }

  function toggleChecklistItem(contentId: string, itemId: string) {
    setChecklistState(prev => {
      const contentItems = prev[contentId] ?? {}
      const next = { ...prev, [contentId]: { ...contentItems, [itemId]: !contentItems[itemId] } }
      localStorage.setItem('training_checklist_state', JSON.stringify(next))
      return next
    })
  }

  function toggleAnswer(questionId: string) {
    setRevealedAnswers(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  function getModuleProgress(mod: TrainingModule) {
    let total = 0
    let done = 0
    for (const ch of mod.chapters) {
      for (const c of ch.content) {
        total++
        if (completion[c.id]) done++
      }
    }
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
  }

  // ─── Expand/Collapse ─────────────────────────────────────────────────────

  function toggleExpand(level: 'module' | 'chapter' | 'content', id: string) {
    const setter = level === 'module' ? setExpandedModules : level === 'chapter' ? setExpandedChapters : setExpandedContent
    setter(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Inline Content Viewer ────────────────────────────────────────────────

  function renderContentView(item: TrainingContentItem) {
    switch (item.type) {
      case 'text':
        return (
          <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
            {item.body || <span className="text-gray-400 italic">No content yet</span>}
          </div>
        )
      case 'video':
        return item.embedUrl ? (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <iframe src={item.embedUrl} className="w-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <span className="text-sm text-gray-400 italic">No video URL set</span>
        )
      case 'checklist':
        return item.items && item.items.length > 0 ? (
          <div className="space-y-1.5">
            {item.items.map(ci => (
              <label key={ci.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={!!checklistState[item.id]?.[ci.id]}
                  onChange={() => toggleChecklistItem(item.id, ci.id)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className={checklistState[item.id]?.[ci.id] ? 'line-through text-gray-400' : ''}>{ci.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-400 italic">No checklist items</span>
        )
      case 'quiz':
        return item.questions && item.questions.length > 0 ? (
          <div className="space-y-3">
            {item.questions.map((q, qi) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">
                  <span className="text-gray-400 mr-1.5">Q{qi + 1}.</span>
                  {q.question}
                </p>
                <button
                  onClick={() => toggleAnswer(q.id)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1.5"
                >
                  {revealedAnswers.has(q.id) ? 'Hide Answer' : 'Show Answer'}
                </button>
                {revealedAnswers.has(q.id) && (
                  <p className="text-sm text-gray-600 mt-2 pl-3 border-l-2 border-emerald-200">{q.answer}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-400 italic">No questions</span>
        )
      default:
        return null
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

  // ─── Header action ────────────────────────────────────────────────────────

  const headerAction = activeTab === 'modules'
    ? { label: 'New Module', onClick: () => setEditTarget({ kind: 'module' as const, module: null }) }
    : activeTab === 'playbooks'
      ? { label: 'New Playbook', onClick: () => setPlaybookPanel({ open: true, playbook: null }) }
      : { label: 'New Template', onClick: () => setTemplatePanel({ open: true, template: null }) }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Header
        title="Sales Enablement"
        subtitle="Training modules, playbooks, and templates"
        action={headerAction}
      />

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'modules'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <GraduationCap size={14} className="inline mr-1.5 -mt-0.5" />
            Modules
            <span className="ml-1.5 text-xs text-gray-400">({modules.length})</span>
          </button>
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

        {/* ── Modules Tab ────────────────────────────────────────────────────── */}
        {activeTab === 'modules' && (
          <>
            {loadingModules ? (
              <div className="text-center py-20 text-gray-400 text-sm">Loading training modules...</div>
            ) : modules.length === 0 ? (
              <div className="text-center py-20">
                <GraduationCap size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No training modules yet</p>
                <p className="text-gray-400 text-xs mt-1">Create modules with chapters and content to train your sales team</p>
                <button
                  onClick={() => setEditTarget({ kind: 'module', module: null })}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: '#015035' }}
                >
                  <Plus size={14} /> Create Module
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {modules.map((mod, modIdx) => {
                  const progress = getModuleProgress(mod)
                  const isExpanded = expandedModules.has(mod.id)

                  return (
                    <div key={mod.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      {/* Module header */}
                      <div className="p-4 flex items-center gap-3">
                        <button onClick={() => toggleExpand('module', mod.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900">{mod.title}</h3>
                          {mod.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{mod.description}</p>}
                        </div>
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${progress.pct}%`, background: progress.pct === 100 ? '#059669' : '#015035' }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium w-8 text-right">
                            {progress.total > 0 ? `${progress.pct}%` : '--'}
                          </span>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => handleMoveModule(modIdx, 'up')}
                            disabled={modIdx === 0}
                            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => handleMoveModule(modIdx, 'down')}
                            disabled={modIdx === modules.length - 1}
                            className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => setEditTarget({ kind: 'module', module: mod })}
                            className="p-1.5 text-gray-400 hover:text-emerald-600"
                            title="Edit module"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteModule(mod.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500"
                            title="Delete module"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: chapters */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50/50">
                          {mod.chapters.length === 0 && (
                            <div className="px-4 py-6 text-center text-xs text-gray-400">No chapters yet</div>
                          )}

                          {mod.chapters.map((ch, chIdx) => {
                            const chExpanded = expandedChapters.has(ch.id)
                            return (
                              <div key={ch.id} className="border-b border-gray-100 last:border-b-0">
                                {/* Chapter header */}
                                <div className="px-4 py-3 pl-10 flex items-center gap-3">
                                  <button onClick={() => toggleExpand('chapter', ch.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                    {chExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                  <Layers size={14} className="text-gray-400 flex-shrink-0" />
                                  <span className="flex-1 text-sm font-medium text-gray-800 min-w-0 truncate">{ch.title}</span>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{ch.content.length} item{ch.content.length !== 1 ? 's' : ''}</span>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    <button
                                      onClick={() => handleMoveChapter(mod.id, chIdx, 'up')}
                                      disabled={chIdx === 0}
                                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      title="Move up"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleMoveChapter(mod.id, chIdx, 'down')}
                                      disabled={chIdx === mod.chapters.length - 1}
                                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                      title="Move down"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                    <button
                                      onClick={() => setEditTarget({ kind: 'chapter', moduleId: mod.id, chapter: ch })}
                                      className="p-1 text-gray-400 hover:text-emerald-600"
                                      title="Edit chapter"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => deleteChapter(mod.id, ch.id)}
                                      className="p-1 text-gray-400 hover:text-red-500"
                                      title="Delete chapter"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Content items */}
                                {chExpanded && (
                                  <div className="pl-[4.5rem] pr-4 pb-3">
                                    {ch.content.length === 0 && (
                                      <p className="text-xs text-gray-400 py-2">No content yet</p>
                                    )}

                                    {ch.content.map((item, itemIdx) => {
                                      const itemExpanded = expandedContent.has(item.id)
                                      return (
                                        <div key={item.id} className="mb-1">
                                          {/* Content row */}
                                          <div className="flex items-center gap-2 py-1.5 group">
                                            <input
                                              type="checkbox"
                                              checked={!!completion[item.id]}
                                              onChange={() => toggleCompletion(item.id)}
                                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 flex-shrink-0"
                                            />
                                            <button
                                              onClick={() => toggleExpand('content', item.id)}
                                              className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                            >
                                              {CONTENT_TYPE_ICONS[item.type]}
                                              <span className={`text-sm truncate ${completion[item.id] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                {item.title}
                                              </span>
                                              <span className="text-[10px] text-gray-400 uppercase flex-shrink-0">{item.type}</span>
                                              {itemExpanded
                                                ? <ChevronDown size={12} className="text-gray-300 flex-shrink-0" />
                                                : <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                                              }
                                            </button>
                                            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={() => handleMoveContent(mod.id, ch.id, itemIdx, 'up')}
                                                disabled={itemIdx === 0}
                                                className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"
                                                title="Move up"
                                              >
                                                <ChevronUp size={12} />
                                              </button>
                                              <button
                                                onClick={() => handleMoveContent(mod.id, ch.id, itemIdx, 'down')}
                                                disabled={itemIdx === ch.content.length - 1}
                                                className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"
                                                title="Move down"
                                              >
                                                <ChevronDown size={12} />
                                              </button>
                                              <button
                                                onClick={() => setEditTarget({ kind: 'content', moduleId: mod.id, chapterId: ch.id, content: item })}
                                                className="p-1 text-gray-300 hover:text-emerald-600"
                                                title="Edit content"
                                              >
                                                <Pencil size={12} />
                                              </button>
                                              <button
                                                onClick={() => deleteContent(mod.id, ch.id, item.id)}
                                                className="p-1 text-gray-300 hover:text-red-500"
                                                title="Delete content"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Expanded content viewer */}
                                          {itemExpanded && (
                                            <div className="ml-6 mt-1 mb-3 p-3 bg-white rounded-xl border border-gray-200">
                                              {renderContentView(item)}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}

                                    <button
                                      onClick={() => setEditTarget({ kind: 'content', moduleId: mod.id, chapterId: ch.id, content: null })}
                                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 mt-2"
                                    >
                                      <Plus size={12} /> Add Content
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {/* Add chapter button */}
                          <div className="px-4 py-3 pl-10">
                            <button
                              onClick={() => setEditTarget({ kind: 'chapter', moduleId: mod.id, chapter: null })}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Chapter
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

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
      {editTarget && (
        <TrainingPanel
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleTrainingSave}
        />
      )}
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
