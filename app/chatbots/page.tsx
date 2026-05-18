'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Bot, Plus, X, Copy, Check, Trash2, Pencil, Globe,
  MessageSquare, ToggleLeft, ToggleRight, Code, ExternalLink,
} from 'lucide-react'

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
}

const defaultForm: ChatbotForm = {
  name: '',
  website_url: '',
  welcome_message: 'Hi! How can I help you today?',
  system_prompt: 'You are a helpful support agent. Answer questions about our services politely and accurately.',
  knowledge: '',
  brand_color: '#015035',
  avatar_url: '',
  active: true,
}

export default function ChatbotsPage() {
  const [bots, setBots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null)
  const [form, setForm] = useState<ChatbotForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [embedBotId, setEmbedBotId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  async function fetchBots() {
    try {
      const res = await fetch('/api/chatbots')
      if (res.ok) setBots(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/chatbots').then(r => r.ok ? r.json() : []).then(data => { if (!cancelled) setBots(data) }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function openCreate() {
    setEditingBot(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(bot: Chatbot) {
    setEditingBot(bot)
    setForm({
      name: bot.name,
      website_url: bot.website_url || '',
      welcome_message: bot.welcome_message,
      system_prompt: bot.system_prompt,
      knowledge: bot.knowledge || '',
      brand_color: bot.brand_color,
      avatar_url: bot.avatar_url || '',
      active: bot.active,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('Name is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        website_url: form.website_url || null,
        knowledge: form.knowledge || null,
        avatar_url: form.avatar_url || null,
      }
      const url = editingBot ? `/api/chatbots/${editingBot.id}` : '/api/chatbots'
      const method = editingBot ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast(editingBot ? 'Chatbot updated' : 'Chatbot created', 'success')
        setShowModal(false)
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

  async function handleDelete(id: string) {
    if (!confirm('Delete this chatbot? All conversations will be removed.')) return
    try {
      const res = await fetch(`/api/chatbots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast('Chatbot deleted', 'success')
        fetchBots()
      }
    } catch {
      toast('Failed to delete', 'error')
    }
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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
                      {bot.website_url && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Globe size={11} />
                          <span>{bot.website_url}</span>
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

      {showModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-base font-bold text-gray-900">{editingBot ? 'Edit Chatbot' : 'Create Chatbot'}</h3>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} className="text-gray-500" /></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp Support Bot" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Website URL</label>
                  <input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://acmecorp.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Welcome Message</label>
                  <input value={form.welcome_message} onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt / Personality</label>
                  <textarea value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" placeholder="You are a helpful support agent for Acme Corp..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Knowledge Base</label>
                  <textarea value={form.knowledge} onChange={e => setForm(f => ({ ...f, knowledge: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" placeholder="Company info, FAQs, pricing, services..." />
                  <p className="text-[11px] text-gray-400 mt-1">Custom knowledge the bot should use when answering questions.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.brand_color} onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))} className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
                      <input value={form.brand_color} onChange={e => setForm(f => ({ ...f, brand_color: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Avatar URL</label>
                    <input value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))} className="flex items-center gap-2 text-sm text-gray-700">
                    {form.active ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} className="text-gray-400" />}
                    {form.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50" style={{ background: '#015035' }}>
                  {saving ? 'Saving...' : editingBot ? 'Save Changes' : 'Create Chatbot'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
