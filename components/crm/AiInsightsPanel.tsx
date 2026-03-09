'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  type: 'company' | 'contact'
  name: string
  context: string
}

export default function AiInsightsPanel({ type, name, context }: Props) {
  const [open, setOpen] = useState(false)
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'ai' | 'template' | null>(null)

  async function fetchInsights() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, context }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as { insights: string; source: 'ai' | 'template' }
      setInsights(data.insights)
      setSource(data.source)
    } catch {
      setInsights('Unable to generate insights at this time. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleToggle() {
    if (!open && !insights) {
      setOpen(true)
      fetchInsights()
    } else {
      setOpen(v => !v)
    }
  }

  // Parse markdown sections into structured output
  function renderInsights(text: string) {
    const sections = text.split(/^## /m).filter(Boolean)
    if (sections.length <= 1) {
      return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{text}</p>
    }

    return (
      <div className="flex flex-col gap-4">
        {sections.map((section, idx) => {
          const lines = section.split('\n')
          const heading = lines[0].trim()
          const body = lines.slice(1).join('\n').trim()
          const bullets = body.split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''))
          const paragraphs = body.split('\n').filter(l => !l.startsWith('-') && l.trim())

          return (
            <div key={idx}>
              <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">{heading}</p>
              {bullets.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {bullets.map((b, bi) => (
                    <li key={bi} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-emerald-600 mt-0.5 flex-shrink-0">·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              ) : (
                paragraphs.map((p, pi) => (
                  <p key={pi} className="text-sm text-gray-700 leading-relaxed">{p}</p>
                ))
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="border border-emerald-200 rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">AI Insights</span>
          {source === 'ai' && (
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-medium">AI</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insights && (
            <button
              onClick={e => { e.stopPropagation(); fetchInsights() }}
              className="p-1 rounded-lg hover:bg-emerald-200 text-emerald-600 transition-colors"
              title="Refresh insights"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-emerald-600" /> : <ChevronDown size={14} className="text-emerald-600" />}
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="px-4 py-4 bg-white">
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin flex-shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ) : insights ? (
            renderInsights(insights)
          ) : null}
        </div>
      )}
    </div>
  )
}
