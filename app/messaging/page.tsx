'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Search, Send, MessageCircle, Plus, Phone, Building2, X, User,
} from 'lucide-react'

interface Contact {
  id: string
  name: string
  phone: string
  company: string
}

interface Conversation {
  id: string
  contact: Contact
  lastMessage: {
    text: string
    timestamp: string
    direction: 'inbound' | 'outbound'
  }
  unreadCount: number
}

interface Message {
  id: string
  conversationId: string
  text: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  status: 'delivered' | 'sent' | 'failed'
}

const SMS_LIMIT = 160

function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMessageTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatMessageDate(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const dateStr = new Date(msg.timestamp).toDateString()
    if (dateStr !== currentDate) {
      currentDate = dateStr
      groups.push({ date: formatMessageDate(msg.timestamp), messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

const MOCK_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Sarah Mitchell', phone: '+1 (512) 555-0142', company: 'Summit Capital' },
  { id: 'c2', name: 'James Rodriguez', phone: '+1 (830) 555-0198', company: 'BlueStar Logistics' },
  { id: 'c3', name: 'Emily Chen', phone: '+1 (210) 555-0267', company: 'Coastal Realty' },
  { id: 'c4', name: 'Marcus Thompson', phone: '+1 (713) 555-0331', company: 'ProVenture LLC' },
  { id: 'c5', name: 'Lisa Park', phone: '+1 (469) 555-0412', company: 'Harvest Foods' },
  { id: 'c6', name: 'David Nguyen', phone: '+1 (956) 555-0589', company: 'Metro Health Group' },
  { id: 'c7', name: 'Rachel Green', phone: '+1 (512) 555-0733', company: 'Apex Marketing' },
  { id: 'c8', name: 'Tom Bradley', phone: '+1 (713) 555-0821', company: 'TechCore Solutions' },
]

export default function MessagingPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/messaging/conversations')
      .then(r => r.ok ? r.json() : [])
      .then((data: Conversation[]) => {
        setConversations(data)
        const contactId = searchParams.get('contact')
        if (contactId) {
          const match = data.find(c => c.contact.id === contactId)
          if (match) setActiveId(match.id)
        }
      })
      .catch(() => toast('Failed to load conversations', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    setMessagesLoading(true)
    fetch(`/api/messaging/${activeId}/messages`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Message[]) => setMessages(data))
      .catch(() => toast('Failed to load messages', 'error'))
      .finally(() => setMessagesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const active = conversations.find(c => c.id === activeId)

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(c =>
      c.contact.name.toLowerCase().includes(q) ||
      c.contact.company.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return MOCK_CONTACTS
    const q = contactSearch.toLowerCase()
    return MOCK_CONTACTS.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.phone.includes(q)
    )
  }, [contactSearch])

  async function handleSend() {
    if (!draft.trim() || !activeId || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/messaging/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.trim() }),
      })
      if (res.ok) {
        const msg: Message = await res.json()
        setMessages(prev => [...prev, msg])
        setConversations(prev => prev.map(c =>
          c.id === activeId
            ? { ...c, lastMessage: { text: msg.text, timestamp: msg.timestamp, direction: 'outbound' } }
            : c
        ))
        setDraft('')
      } else {
        toast('Failed to send message', 'error')
      }
    } catch {
      toast('Failed to send message', 'error')
    } finally {
      setSending(false)
    }
  }

  function handleSelectContact(contact: Contact) {
    const existing = conversations.find(c => c.contact.phone === contact.phone)
    if (existing) {
      setActiveId(existing.id)
    } else {
      const newConv: Conversation = {
        id: `conv-${Date.now()}`,
        contact,
        lastMessage: { text: '', timestamp: new Date().toISOString(), direction: 'outbound' },
        unreadCount: 0,
      }
      setConversations(prev => [newConv, ...prev])
      setActiveId(newConv.id)
      setMessages([])
    }
    setShowNewMessage(false)
    setContactSearch('')
  }

  const charCount = draft.length
  const overLimit = charCount > SMS_LIMIT
  const messageGroups = groupMessagesByDate(messages)

  return (
    <>
      <Header title="Messaging" subtitle="SMS conversations" />
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
        {/* Left: Conversation List */}
        <div className="w-80 xl:w-96 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
              />
            </div>
            <button
              onClick={() => setShowNewMessage(true)}
              className="p-2 rounded-lg text-white flex-shrink-0 hover:opacity-90 transition-opacity"
              style={{ background: '#015035' }}
              title="New message"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-green-700 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No conversations found</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveId(conv.id); setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c)) }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${activeId === conv.id ? 'bg-green-50/60' : ''}`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                    style={{ background: '#015035' }}
                  >
                    {conv.contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800 truncate">{conv.contact.name}</span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTime(conv.lastMessage.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{conv.lastMessage.text || 'No messages yet'}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span
                      className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0 mt-1"
                      style={{ background: '#015035' }}
                    >
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Conversation */}
        <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
          {active ? (
            <>
              {/* Conversation Header */}
              <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: '#015035' }}
                >
                  {active.contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{active.contact.name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Phone size={11} /> {active.contact.phone}</span>
                    <span className="flex items-center gap-1"><Building2 size={11} /> {active.contact.company}</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-green-700 rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messageGroups.map(group => (
                    <div key={group.date}>
                      <div className="flex items-center justify-center my-4">
                        <span className="text-[11px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100 font-medium">
                          {group.date}
                        </span>
                      </div>
                      {group.messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex mb-2 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] px-3.5 py-2 rounded-2xl ${
                              msg.direction === 'outbound'
                                ? 'text-white rounded-br-md'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                            }`}
                            style={msg.direction === 'outbound' ? { background: '#015035' } : undefined}
                          >
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'}`}>
                              {formatMessageTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-3 bg-white border-t border-gray-200">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors resize-none"
                      style={{ minHeight: '42px', maxHeight: '120px' }}
                    />
                    <span className={`absolute right-3 bottom-2 text-[10px] font-medium ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
                      {charCount}/{SMS_LIMIT}
                    </span>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="p-2.5 rounded-xl text-white transition-opacity disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    <Send size={16} />
                  </button>
                </div>
                {overLimit && (
                  <p className="text-[11px] text-red-500 mt-1">Message exceeds 160-character SMS limit and may be split into multiple segments.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">Select a conversation</p>
                <p className="text-xs text-gray-400 mt-1">Choose from the list or start a new message</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewMessage(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">New Message</h3>
              <button onClick={() => setShowNewMessage(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-green-700 focus:bg-white transition-colors"
                  autoFocus
                />
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-400">No contacts found</p>
                ) : (
                  filteredContacts.map(contact => (
                    <button
                      key={contact.id}
                      onClick={() => handleSelectContact(contact)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{contact.name}</p>
                        <p className="text-xs text-gray-500">{contact.phone} &middot; {contact.company}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
