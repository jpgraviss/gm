'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AssistantPanelProps {
  open: boolean
  onClose: () => void
}

const SUGGESTIONS = [
  'Show me the dashboard summary',
  'Find all overdue invoices',
  'Search for deals in Proposal Sent stage',
  'Generate a proposal for a new client',
  'List all document templates',
  'Who are our active clients?',
]

export default function AssistantPanel({ open, onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await res.json()

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-reply`,
        role: 'assistant',
        content: data.reply ?? data.error ?? 'Sorry, something went wrong.',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: 'Failed to reach the AI assistant. Please check your connection and try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearChat() {
    setMessages([])
  }

  // Format markdown-ish content (basic)
  function formatContent(content: string) {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/, '').replace(/```$/, '')
        return (
          <pre key={i} className="bg-gray-900 text-green-300 rounded-lg p-3 text-xs overflow-x-auto my-2 whitespace-pre-wrap">
            {code}
          </pre>
        )
      }

      // Process inline formatting
      const lines = part.split('\n')
      return lines.map((line, j) => {
        // Headers
        if (line.startsWith('### ')) return <h4 key={`${i}-${j}`} className="font-bold text-xs text-gray-800 mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={`${i}-${j}`} className="font-bold text-sm text-gray-900 mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={`${i}-${j}`} className="font-bold text-sm text-gray-900 mt-3 mb-1">{line.slice(2)}</h2>

        // Horizontal rule (--- GENERATED ...)
        if (line.startsWith('---')) return <hr key={`${i}-${j}`} className="my-2 border-gray-200" />

        // Bold
        const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        // List items
        if (line.match(/^[\-\*]\s/)) {
          return <li key={`${i}-${j}`} className="ml-4 text-xs list-disc" dangerouslySetInnerHTML={{ __html: boldProcessed.slice(2) }} />
        }
        if (line.match(/^\d+\.\s/)) {
          return <li key={`${i}-${j}`} className="ml-4 text-xs list-decimal" dangerouslySetInnerHTML={{ __html: boldProcessed.replace(/^\d+\.\s/, '') }} />
        }

        // Table rows
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) return null // skip separator rows
          const cells = line.split('|').filter(Boolean).map(c => c.trim())
          return (
            <div key={`${i}-${j}`} className="flex gap-2 text-xs py-0.5 border-b border-gray-100">
              {cells.map((cell, k) => (
                <span key={k} className="flex-1 truncate">{cell}</span>
              ))}
            </div>
          )
        }

        // Empty line
        if (!line.trim()) return <div key={`${i}-${j}`} className="h-2" />

        // Regular paragraph
        return <p key={`${i}-${j}`} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: boldProcessed }} />
      })
    })
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(480px, 100vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0" style={{ background: '#015035' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">GravHub AI</h2>
              <p className="text-[10px] text-white/60">Search, analyze, generate docs</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Clear chat"
              >
                <Trash2 size={14} className="text-white/70" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={16} className="text-white/70" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#015035' + '12' }}
              >
                <Bot size={28} style={{ color: '#015035' }} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">How can I help?</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-sm">
                I can search your CRM, look up deals and invoices, generate proposals and contracts, and give you a real-time business summary.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#015035' + '14' }}
                  >
                    <Bot size={12} style={{ color: '#015035' }} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 border border-gray-200 text-gray-800'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  ) : (
                    <div className="space-y-0.5">{formatContent(msg.content)}</div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={12} className="text-gray-600" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#015035' + '14' }}
              >
                <Bot size={12} style={{ color: '#015035' }} />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-gray-400" />
                <span className="text-xs text-gray-500">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none resize-none max-h-32"
              style={{ minHeight: '20px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ background: input.trim() ? '#015035' : 'transparent' }}
            >
              <Send size={14} className={input.trim() ? 'text-white' : 'text-gray-400'} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            Powered by Claude — responses may not always be accurate
          </p>
        </div>
      </div>
    </>
  )
}
