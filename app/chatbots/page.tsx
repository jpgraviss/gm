'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Bot, Plus, X, Copy, Check, Trash2, Pencil, Globe,
  MessageSquare, ToggleLeft, ToggleRight, Code, ExternalLink,
  Send, FileText, Link2, HelpCircle,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────── */

interface KnowledgeItem {
  id: string
  type: 'qa' | 'document' | 'url'
  question?: string
  answer?: string
  title?: string
  content?: string
  url?: string
  description?: string
}

interface Chatbot {
  id: string
  name: string
  website_url: string | null
  welcome_message: string
  system_prompt: string
  knowledge: string | null
  brand_color: string
  avatar_url: string | null
  active: boolean
  settings: Record<string, unknown>
  conversations_count: number
  created_at: string
  updated_at: string
}

interface ChatbotForm {
  name: string
  website_url: string
  welcome_message: string
  system_prompt: string
  knowledge: string
  brand_color: string
  avatar_url: string
  active: boolean
  knowledge_items: KnowledgeItem[]
}

interface TestMessage {
  role: 'user' | 'assistant'
  content: string
}

type ModalTab = 'config' | 'knowledge' | 'test'

const uid = () => `ki_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const defaultForm: ChatbotForm = {
  name: '',
  website_url: '',
  welcome_message: 'Hi! How can I help you today?',
  system_prompt: 'You are a helpful support agent. Answer questions about our services politely and accurately.',
  knowledge: '',
  brand_color: '#015035',
  avatar_url: '',
  active: true,
  knowledge_items: [],
}

/* ── Component ─────────────────────────────────────────────── */

export default function ChatbotsPage() {
  const [bots, setBots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null)
  const [form, setForm] = useState<ChatbotForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [embedBotId, setEmbedBotId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<ModalTab>('config')
  const { toast } = useToast()

  /* knowledge editing */
  const [addingType, setAddingType] = useState<'qa' | 'document' | 'url' | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [kForm, setKForm] = useState({ question: '', answer: '', title: '', content: '', url: '', description: '' })

  /* test chat */
  const [testMessages, setTestMessages] = useState<TestMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testConvoId, setTestConvoId] = useState<string | null>(null)
  const testEndRef = useRef<HTMLDivElement>(null)

  /* ── Data fetching ─────────────────────────────────────────── */

  async function fetchBots() {
    try {
      const res = await fetch('/api/chatbots')
      if (res.ok) setBots(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/chatbots')
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (!cancelled) setBots(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  /* ── Modal open / close ────────────────────────────────────── */

  function resetModalState() {
    setActiveTab('config')
    setAddingType(null)
    setEditingItemId(null)
    setTestMessages([])
    setTestInput('')
    setTestConvoId(null)
  }

  function openCreate() {
    setEditingBot(null)
    setForm(defaultForm)
    resetModalState()
    setShowModal(true)
  }

  function openEdit(bot: Chatbot) {
    setEditingBot(bot)
    const items = (
      (bot.settings as Record<string, unknown>)?.knowledge_items as KnowledgeItem[] | undefined
    ) || []
    setForm({
      name: bot.name,
      website_url: bot.website_url || '',
      welcome_message: bot.welcome_message,
      system_prompt: bot.system_prompt,
      knowledge: bot.knowledge || '',
      brand_color: bot.brand_color,
      avatar_url: bot.avatar_url || '',
      active: bot.active,
      knowledge_items: items,
    })
    resetModalState()
    setShowModal(true)
  }

  /* ── Save ──────────────────────────────────────────────────── */

  async function handleSave() {
    if (!form.name.trim()) { toast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const existingSettings = (editingBot?.settings || {}) as Record<string, unknown>
      const payload: Record<string, unknown> = {
        name: form.name,
        website_url: form.website_url || null,
        welcome_message: form.welcome_message,
        system_prompt: form.system_prompt,
        knowledge: form.knowledge || null,
        brand_color: form.brand_color,
        avatar_url: form.avatar_url || null,
        active: form.active,
        settings: { ...existingSettings, knowledge_items: form.knowledge_items },
      }
      const url = editingBot ? `/api/chatbots/${editingBot.id}` : '/api/chatbots'
      const method = editingBot ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        const saved = await res.json()
        toast(editingBot ? 'Chatbot updated' : 'Chatbot created', 'success')
        setEditingBot(saved)
        fetchBots()
      } else {
        const err = await res.json()
        toast(err.error || 'Failed to save', 'error')
      }
    } catch {
      toast('Failed to save chatbot', 'error')
    }
    setSaving(false)
  }

  /* ── Delete / toggle ───────────────────────────────────────── */

  async function handleDelete(id: string) {
    if (!confirm('Delete this chatbot? All conversations will be removed.')) return
    try {
      const res = await fetch(`/api/chatbots/${id}`, { method: 'DELETE' })
      if (res.ok) { toast('Chatbot deleted', 'success'); fetchBots() }
    } catch { toast('Failed to delete', 'error') }
  }

  async function toggleActive(bot: Chatbot) {
    try {
      await fetch(`/api/chatbots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !bot.active }),
      })
      fetchBots()
    } catch { /* ignore */ }
  }

  /* ── Embed helpers ─────────────────────────────────────────── */

  function getEmbedCode(bot: Chatbot) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.gravissmarketing.com'
    return `<script src="${baseUrl}/chatbot.js"\n  data-chatbot-id="${bot.id}"\n  data-color="${bot.brand_color}"\n  data-position="bottom-right">\n</script>`
  }

  function copyEmbed(bot: Chatbot) {
    navigator.clipboard.writeText(getEmbedCode(bot))
    setCopied(true)
    setEmbedBotId(bot.id)
    setTimeout(() => { setCopied(false); setEmbedBotId(null) }, 2000)
  }

  /* ── Knowledge CRUD ────────────────────────────────────────── */

  function startAddKnowledge(type: 'qa' | 'document' | 'url') {
    setAddingType(type)
    setEditingItemId(null)
    setKForm({ question: '', answer: '', title: '', content: '', url: '', description: '' })
  }

  function startEditKnowledge(item: KnowledgeItem) {
    setEditingItemId(item.id)
    setAddingType(null)
    setKForm({
      question: item.question || '',
      answer: item.answer || '',
      title: item.title || '',
      content: item.content || '',
      url: item.url || '',
      description: item.description || '',
    })
  }

  function saveKnowledgeItem() {
    if (addingType) {
      if (addingType === 'qa' && (!kForm.question.trim() || !kForm.answer.trim())) {
        toast('Question and answer are required', 'error'); return
      }
      if (addingType === 'document' && (!kForm.title.trim() || !kForm.content.trim())) {
        toast('Title and content are required', 'error'); return
      }
      if (addingType === 'url' && !kForm.url.trim()) {
        toast('URL is required', 'error'); return
      }
      const item: KnowledgeItem = { id: uid(), type: addingType }
      if (addingType === 'qa') { item.question = kForm.question.trim(); item.answer = kForm.answer.trim() }
      else if (addingType === 'document') { item.title = kForm.title.trim(); item.content = kForm.content.trim() }
      else { item.url = kForm.url.trim(); item.description = kForm.description.trim() || undefined }
      setForm(f => ({ ...f, knowledge_items: [...f.knowledge_items, item] }))
    } else if (editingItemId) {
      const existing = form.knowledge_items.find(i => i.id === editingItemId)
      if (!existing) return
      if (existing.type === 'qa' && (!kForm.question.trim() || !kForm.answer.trim())) {
        toast('Question and answer are required', 'error'); return
      }
      if (existing.type === 'document' && (!kForm.title.trim() || !kForm.content.trim())) {
        toast('Title and content are required', 'error'); return
      }
      if (existing.type === 'url' && !kForm.url.trim()) {
        toast('URL is required', 'error'); return
      }
      setForm(f => ({
        ...f,
        knowledge_items: f.knowledge_items.map(i => {
          if (i.id !== editingItemId) return i
          const u = { ...i }
          if (i.type === 'qa') { u.question = kForm.question.trim(); u.answer = kForm.answer.trim() }
          else if (i.type === 'document') { u.title = kForm.title.trim(); u.content = kForm.content.trim() }
          else { u.url = kForm.url.trim(); u.description = kForm.description.trim() || undefined }
          return u
        }),
      }))
    }
    setAddingType(null)
    setEditingItemId(null)
  }

  function deleteKnowledgeItem(id: string) {
    setForm(f => ({ ...f, knowledge_items: f.knowledge_items.filter(i => i.id !== id) }))
    if (editingItemId === id) setEditingItemId(null)
  }

  function cancelKnowledgeEdit() {
    setAddingType(null)
    setEditingItemId(null)
  }

  /* ── Test chat ─────────────────────────────────────────────── */

  async function sendTestMessage() {
    if (!testInput.trim() || !editingBot || testSending) return
    const msg = testInput.trim()
    setTestInput('')
    setTestMessages(prev => [...prev, { role: 'user', content: msg }])
    setTestSending(true)
    try {
      const res = await fetch(`/api/chatbots/${editingBot.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId: testConvoId }),
      })
      const data = await res.json()
      if (data.conversationId) setTestConvoId(data.conversationId)
      setTestMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'No response' }])
    } catch {
      setTestMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to chatbot.' }])
    }
    setTestSending(false)
  }

  useEffect(() => {
    testEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [testMessages])

  /* ── Inline form for knowledge items ───────────────────────── */

  function renderKnowledgeForm(type: 'qa' | 'document' | 'url') {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
        {type === 'qa' && (
          <>
            <input
              value={kForm.question}
              onChange={e => setKForm(f => ({ ...f, question: e.target.value }))}
              placeholder="Question"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
            <textarea
              value={kForm.answer}
              onChange={e => setKForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="Answer"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none bg-white"
            />
          </>
        )}
        {type === 'document' && (
          <>
            <input
              value={kForm.title}
              onChange={e => setKForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Document title"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
            <textarea
              value={kForm.content}
              onChange={e => setKForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Paste or type document content..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none bg-white"
            />
          </>
        )}
        {type === 'url' && (
          <>
            <input
              value={kForm.url}
              onChange={e => setKForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com/page"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
            <input
              value={kForm.description}
              onChange={e => setKForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
          </>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={saveKnowledgeItem} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ background: '#015035' }}>
            {editingItemId ? 'Update' : 'Add'}
          </button>
          <button onClick={cancelKnowledgeEdit} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  /* ── Helpers ───────────────────────────────────────────────── */

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const qaItems = form.knowledge_items.filter(i => i.type === 'qa')
  const docItems = form.knowledge_items.filter(i => i.type === 'document')
  const urlItems = form.knowledge_items.filter(i => i.type === 'url')

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <Header title="Chatbots" subtitle="Embeddable AI chatbots for client websites" />

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Your Chatbots</h2>
            <p className="text-sm text-gray-500">Create and manage AI chatbots that can be embedded on any website.</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
            <Plus size={16} /> Create Chatbot
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-[#015035] rounded-full animate-spin" />
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-20">
            <Bot size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-700 mb-1">No chatbots yet</h3>
            <p className="text-xs text-gray-500 mb-4">Create your first chatbot to embed on a client website.</p>
            <button onClick={openCreate} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#015035' }}>
              <Plus size={14} className="inline mr-1" /> Create Chatbot
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {bots.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: bot.brand_color + '18' }}>
                      <Bot size={20} style={{ color: bot.brand_color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{bot.name}</h3>
                      {bot.website_url ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Globe size={11} />
                          <span>{bot.website_url}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5" title="No website URL set — this bot can be embedded and run from any site">
                          <Globe size={11} />
                          <span>No website URL — embeddable anywhere</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${bot.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {bot.active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} /> {bot.conversations_count} conversations
                        </span>
                        <span>Updated {formatDate(bot.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(bot)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title={bot.active ? 'Deactivate' : 'Activate'}>
                      {bot.active ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} className="text-gray-400" />}
                    </button>
                    <button onClick={() => copyEmbed(bot)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Copy embed code">
                      {copied && embedBotId === bot.id ? <Check size={15} className="text-emerald-600" /> : <Code size={15} className="text-gray-500" />}
                    </button>
                    <button onClick={() => openEdit(bot)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Edit">
                      <Pencil size={15} className="text-gray-500" />
                    </button>
                    <Link href={`/chatbots/${bot.id}/conversations`} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="View conversations">
                      <ExternalLink size={15} className="text-gray-500" />
                    </Link>
                    <button onClick={() => handleDelete(bot.id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Delete">
                      <Trash2 size={15} className="text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-[11px] font-medium text-gray-500 mb-1">Embed Code</p>
                  <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-all">{getEmbedCode(bot)}</pre>
                  <button onClick={() => copyEmbed(bot)} className="mt-2 text-[11px] font-medium flex items-center gap-1" style={{ color: '#015035' }}>
                    {copied && embedBotId === bot.id ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy to clipboard</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────── */}

      {showModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
              style={{ maxHeight: '85vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header + Tabs */}
              <div className="px-6 pt-4 pb-3 border-b border-gray-200 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-900">
                    {editingBot ? 'Edit Chatbot' : 'Create Chatbot'}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>
                <div className="flex gap-1">
                  {(
                    ['config', 'knowledge', ...(editingBot ? ['test'] : [])] as ModalTab[]
                  ).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        activeTab === tab
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {tab === 'config'
                        ? 'Configuration'
                        : tab === 'knowledge'
                          ? 'Knowledge'
                          : 'Test Chat'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* ─── Config tab ──────────────────────────────── */}
                {activeTab === 'config' && (
                  <div className="px-6 py-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Acme Corp Support Bot"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Website URL</label>
                      <input
                        value={form.website_url}
                        onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                        placeholder="https://acmecorp.com"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      {/* AUDIT #346 — chatbot ids are only origin-bound to a
                          specific domain when this is set; without it,
                          anyone who finds/guesses this bot's id can embed
                          and run it from any site, burning this bot's AI
                          spend and impersonating this brand off-domain. */}
                      {!form.website_url.trim() && (
                        <p className="text-[10px] text-amber-600 mt-1">
                          Without a website URL, anyone who has this bot&apos;s id can embed it on their own site and run up your AI usage. Set it once the bot&apos;s live domain is known.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Welcome Message</label>
                      <input
                        value={form.welcome_message}
                        onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt / Personality</label>
                      <textarea
                        value={form.system_prompt}
                        onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                        placeholder="You are a helpful support agent for Acme Corp..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Knowledge Base (free text)</label>
                      <textarea
                        value={form.knowledge}
                        onChange={e => setForm(f => ({ ...f, knowledge: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                        placeholder="Company info, FAQs, pricing, services..."
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Free-text knowledge appended to the system prompt. For structured knowledge (Q&amp;A, documents, URLs) use the Knowledge tab.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Brand Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.brand_color}
                            onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))}
                            className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                          />
                          <input
                            value={form.brand_color}
                            onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Avatar URL</label>
                        <input
                          value={form.avatar_url}
                          onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        {form.active ? (
                          <ToggleRight size={20} className="text-emerald-600" />
                        ) : (
                          <ToggleLeft size={20} className="text-gray-400" />
                        )}
                        {form.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── Knowledge tab ──────────────────────────── */}
                {activeTab === 'knowledge' && (
                  <div className="px-6 py-4 space-y-6">
                    {/* Q&A Pairs */}
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <HelpCircle size={16} className="text-blue-500" />
                          <h4 className="text-sm font-semibold text-gray-900">
                            Q&amp;A Pairs
                            {qaItems.length > 0 && (
                              <span className="ml-1.5 text-[11px] font-normal text-gray-400">({qaItems.length})</span>
                            )}
                          </h4>
                        </div>
                        <button
                          onClick={() => startAddKnowledge('qa')}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                          style={{ color: '#015035' }}
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {qaItems.map(item => (
                          <div key={item.id}>
                            {editingItemId === item.id ? (
                              renderKnowledgeForm('qa')
                            ) : (
                              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                                <p className="text-xs font-medium text-gray-700">Q: {item.question}</p>
                                <p className="text-xs text-gray-500 mt-1">A: {item.answer}</p>
                                <div className="flex items-center gap-1 mt-2">
                                  <button onClick={() => startEditKnowledge(item)} className="p-1 rounded hover:bg-gray-100">
                                    <Pencil size={12} className="text-gray-400" />
                                  </button>
                                  <button onClick={() => deleteKnowledgeItem(item.id)} className="p-1 rounded hover:bg-gray-100">
                                    <Trash2 size={12} className="text-red-400" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {addingType === 'qa' && renderKnowledgeForm('qa')}
                        {qaItems.length === 0 && addingType !== 'qa' && (
                          <p className="text-[11px] text-gray-400 py-1">No Q&amp;A pairs yet. Add common questions and answers for the chatbot to reference.</p>
                        )}
                      </div>
                    </section>

                    {/* Documents */}
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-amber-500" />
                          <h4 className="text-sm font-semibold text-gray-900">
                            Documents
                            {docItems.length > 0 && (
                              <span className="ml-1.5 text-[11px] font-normal text-gray-400">({docItems.length})</span>
                            )}
                          </h4>
                        </div>
                        <button
                          onClick={() => startAddKnowledge('document')}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                          style={{ color: '#015035' }}
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {docItems.map(item => (
                          <div key={item.id}>
                            {editingItemId === item.id ? (
                              renderKnowledgeForm('document')
                            ) : (
                              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                                <p className="text-xs font-semibold text-gray-700">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content}</p>
                                <div className="flex items-center gap-1 mt-2">
                                  <button onClick={() => startEditKnowledge(item)} className="p-1 rounded hover:bg-gray-100">
                                    <Pencil size={12} className="text-gray-400" />
                                  </button>
                                  <button onClick={() => deleteKnowledgeItem(item.id)} className="p-1 rounded hover:bg-gray-100">
                                    <Trash2 size={12} className="text-red-400" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {addingType === 'document' && renderKnowledgeForm('document')}
                        {docItems.length === 0 && addingType !== 'document' && (
                          <p className="text-[11px] text-gray-400 py-1">No documents yet. Add reference documents the chatbot can use to answer questions.</p>
                        )}
                      </div>
                    </section>

                    {/* URLs */}
                    <section>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Link2 size={16} className="text-purple-500" />
                          <h4 className="text-sm font-semibold text-gray-900">
                            URLs
                            {urlItems.length > 0 && (
                              <span className="ml-1.5 text-[11px] font-normal text-gray-400">({urlItems.length})</span>
                            )}
                          </h4>
                        </div>
                        <button
                          onClick={() => startAddKnowledge('url')}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100"
                          style={{ color: '#015035' }}
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {urlItems.map(item => (
                          <div key={item.id}>
                            {editingItemId === item.id ? (
                              renderKnowledgeForm('url')
                            ) : (
                              <div className="border border-gray-200 rounded-lg p-3 bg-white">
                                <p className="text-xs font-medium text-blue-600 break-all">{item.url}</p>
                                {item.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                )}
                                <div className="flex items-center gap-1 mt-2">
                                  <button onClick={() => startEditKnowledge(item)} className="p-1 rounded hover:bg-gray-100">
                                    <Pencil size={12} className="text-gray-400" />
                                  </button>
                                  <button onClick={() => deleteKnowledgeItem(item.id)} className="p-1 rounded hover:bg-gray-100">
                                    <Trash2 size={12} className="text-red-400" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {addingType === 'url' && renderKnowledgeForm('url')}
                        {urlItems.length === 0 && addingType !== 'url' && (
                          <p className="text-[11px] text-gray-400 py-1">No URLs yet. Add reference links the chatbot should know about.</p>
                        )}
                      </div>
                    </section>

                    <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                      Remember to save after making changes. Structured knowledge items are formatted and appended to the system prompt alongside the free-text knowledge base.
                    </p>
                  </div>
                )}

                {/* ─── Test Chat tab ──────────────────────────── */}
                {activeTab === 'test' && editingBot && (
                  <div className="flex flex-col" style={{ height: '55vh' }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {testMessages.length === 0 && (
                        <div className="text-center py-10">
                          <MessageSquare size={28} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-400">Send a message to test your chatbot.</p>
                          <p className="text-[11px] text-gray-400 mt-1">Make sure to save any changes before testing.</p>
                        </div>
                      )}
                      {testMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                            }`}
                            style={msg.role === 'user' ? { background: form.brand_color } : undefined}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {testSending && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm text-sm text-gray-400">
                            Typing...
                          </div>
                        </div>
                      )}
                      <div ref={testEndRef} />
                    </div>
                    <div className="border-t border-gray-200 p-3 flex gap-2 shrink-0">
                      <input
                        value={testInput}
                        onChange={e => setTestInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTestMessage() } }}
                        placeholder="Type a test message..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        disabled={testSending}
                      />
                      <button
                        onClick={sendTestMessage}
                        disabled={testSending || !testInput.trim()}
                        className="px-3 py-2 rounded-lg text-white disabled:opacity-50 shrink-0"
                        style={{ background: form.brand_color }}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {activeTab !== 'test' && (
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 shrink-0">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50"
                    style={{ background: '#015035' }}
                  >
                    {saving ? 'Saving...' : editingBot ? 'Save Changes' : 'Create Chatbot'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
