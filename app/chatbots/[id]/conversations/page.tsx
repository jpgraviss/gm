'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft, Search, Flag, CheckCircle, Trash2, X,
  MessageSquare, User, Bot,
} from 'lucide-react'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface Conversation {
  id: string
  chatbot_id: string
  visitor_id: string | null
  visitor_name: string | null
  visitor_email: string | null
  messages: ConversationMessage[]
  status: string
  flagged: boolean
  created_at: string
  updated_at: string
}

interface ChatbotInfo {
  id: string
  name: string
  brand_color: string
}

type StatusFilter = 'all' | 'active' | 'flagged' | 'resolved'

export default function ConversationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [chatbot, setChatbot] = useState<ChatbotInfo | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetch(`/api/chatbots/${id}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setChatbot(d) }).catch(() => {})
  }, [id])

  useEffect(() => { fetchConversations() }, [id, filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchConversations() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/chatbots/${id}/conversations?${params}`)
      if (res.ok) setConversations(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  async function toggleFlag(convo: Conversation) {
    try {
      await fetch(`/api/chatbots/${id}/conversations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convo.id, flagged: !convo.flagged }),
      })
      toast(convo.flagged ? 'Unflagged' : 'Flagged', 'success')
      fetchConversations()
      if (selectedConvo?.id === convo.id) setSelectedConvo({ ...convo, flagged: !convo.flagged })
    } catch { toast('Failed to update', 'error') }
  }

  async function markResolved(convo: Conversation) {
    try {
      await fetch(`/api/chatbots/${id}/conversations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convo.id, status: 'resolved' }),
      })
      toast('Marked as resolved', 'success')
      fetchConversations()
      if (selectedConvo?.id === convo.id) setSelectedConvo({ ...convo, status: 'resolved' })
    } catch { toast('Failed to update', 'error') }
  }

  async function deleteConvo(convoId: string) {
    if (!confirm('Delete this conversation?')) return
    try {
      await fetch(`/api/chatbots/${id}/conversations?conversationId=${convoId}`, { method: 'DELETE' })
      toast('Conversation deleted', 'success')
      if (selectedConvo?.id === convoId) setSelectedConvo(null)
      fetchConversations()
    } catch { toast('Failed to delete', 'error') }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const brandColor = chatbot?.brand_color || '#015035'
  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'flagged', label: 'Flagged' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <Header title={chatbot?.name ? `${chatbot.name} — Conversations` : 'Conversations'} subtitle="Monitor and moderate chatbot conversations" />

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Link href="/chatbots" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={14} /> Back to Chatbots
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f.key ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                style={filter === f.key ? { background: brandColor } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div className={`flex-1 ${selectedConvo ? 'max-w-sm' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-gray-300 rounded-full animate-spin" style={{ borderTopColor: brandColor }} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-20">
                <MessageSquare size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No conversations found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map(convo => (
                  <div
                    key={convo.id}
                    onClick={() => setSelectedConvo(convo)}
                    className={`bg-white rounded-lg border p-4 cursor-pointer transition-colors hover:border-gray-300 ${selectedConvo?.id === convo.id ? 'border-gray-400 ring-1 ring-gray-200' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-gray-700">{convo.visitor_name || convo.visitor_id || 'Anonymous'}</span>
                        {convo.flagged && <Flag size={12} className="text-red-500 fill-red-500" />}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${convo.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : convo.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {convo.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {convo.messages.length > 0 ? convo.messages[convo.messages.length - 1].content : 'No messages'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      <span>{convo.messages.length} messages</span>
                      <span>{formatDate(convo.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedConvo && (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col max-h-[calc(100vh-240px)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedConvo.visitor_name || selectedConvo.visitor_id || 'Anonymous'}
                  </p>
                  <p className="text-[11px] text-gray-400">{formatDate(selectedConvo.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleFlag(selectedConvo)} className="p-1.5 rounded-lg hover:bg-gray-100" title={selectedConvo.flagged ? 'Unflag' : 'Flag'}>
                    <Flag size={14} className={selectedConvo.flagged ? 'text-red-500 fill-red-500' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => markResolved(selectedConvo)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Mark resolved">
                    <CheckCircle size={14} className={selectedConvo.status === 'resolved' ? 'text-emerald-500' : 'text-gray-400'} />
                  </button>
                  <button onClick={() => deleteConvo(selectedConvo.id)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Delete">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                  <button onClick={() => setSelectedConvo(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedConvo.messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: brandColor + '14' }}>
                        <Bot size={12} style={{ color: brandColor }} />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-gray-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
