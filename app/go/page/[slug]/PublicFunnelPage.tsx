'use client'

import { useState } from 'react'
import { PlayCircle, ChevronDown } from 'lucide-react'
import { utmFromLocation } from '@/lib/attribution'

interface Block {
  id: string
  type: string
  data: Record<string, unknown>
}

function FaqAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <span className="font-semibold text-sm">{question}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm opacity-70">{answer}</div>}
    </div>
  )
}

function FormBlock({ data, funnelSlug, pageId }: { data: Record<string, unknown>; funnelSlug: string; pageId: string }) {
  const fields = (data.fields ?? []) as Array<{ name: string; label: string; type: string; required: boolean }>
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const bgColor = (data.bgColor as string) ?? '#ffffff'
  const textColor = (data.textColor as string) ?? '#111827'
  const padding = `${data.padding ?? '60'}px`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    try {
      const utm = utmFromLocation()
      const res = await fetch('/api/forms/public/funnel-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelSlug, pageId, data: formData, ...(utm ? { utm } : {}) }),
      })
      if (!res.ok) {
        setError(true)
      } else {
        setSubmitted(true)
      }
    } catch {
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ background: bgColor, color: textColor, padding }} className="text-center">
        <p className="text-xl font-bold mb-2">Thank you!</p>
        <p className="opacity-70">We&apos;ll be in touch soon.</p>
      </div>
    )
  }

  return (
    <div style={{ background: bgColor, color: textColor, padding }}>
      <div className="max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{data.heading as string}</h2>
        <p className="text-center opacity-70 text-sm mb-6">{data.subheadline as string}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium mb-1">{f.label}{f.required && ' *'}</label>
              {f.type === 'textarea' ? (
                <textarea
                  required={f.required}
                  value={formData[f.name] ?? ''}
                  onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900"
                />
              ) : (
                <input
                  type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                  required={f.required}
                  value={formData[f.name] ?? ''}
                  onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900"
                />
              )}
            </div>
          ))}
          {error && (
            <p className="text-sm text-red-600 text-center">Something went wrong — please try again.</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            {submitting ? 'Sending...' : (data.buttonText as string) ?? 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PublicBlock({ block, funnelSlug, pageId }: { block: Block; funnelSlug: string; pageId: string }) {
  const d = block.data
  const padding = `${d.padding ?? '60'}px`
  const bgColor = (d.bgColor as string) ?? '#ffffff'
  const textColor = (d.textColor as string) ?? '#111827'

  switch (block.type) {
    case 'hero':
      return (
        <section style={{ background: bgColor, color: textColor, padding }} className="text-center">
          {(d.imageUrl as string) && (
            <img src={d.imageUrl as string} alt="" className="max-h-48 mx-auto mb-6 rounded-lg object-cover" />
          )}
          <h1 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>{d.headline as string}</h1>
          <p className="text-lg md:text-xl opacity-80 mb-8 max-w-2xl mx-auto">{d.subheadline as string}</p>
          {(d.buttonText as string) && (
            <a
              href={d.buttonUrl as string}
              className="inline-block px-8 py-4 rounded-lg font-semibold text-lg transition-transform hover:scale-105"
              style={{ background: textColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : '#015035', color: '#ffffff' }}
            >
              {d.buttonText as string}
            </a>
          )}
        </section>
      )
    case 'features': {
      const features = (d.features ?? []) as Array<{ icon: string; title: string; description: string }>
      return (
        <section style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((f, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: '#01503515' }}>
                  <span className="text-xl" style={{ color: '#015035' }}>&#9733;</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="opacity-70">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      )
    }
    case 'testimonials': {
      const testimonials = (d.testimonials ?? []) as Array<{ name: string; role: string; quote: string }>
      return (
        <section style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl border" style={{ borderColor: `${textColor}15` }}>
                <p className="mb-4 italic">&ldquo;{t.quote}&rdquo;</p>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm opacity-60">{t.role}</p>
              </div>
            ))}
          </div>
        </section>
      )
    }
    case 'cta':
      return (
        <section style={{ background: bgColor, color: textColor, padding }} className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>{d.headline as string}</h2>
          <p className="text-lg opacity-80 mb-8 max-w-xl mx-auto">{d.subheadline as string}</p>
          <a
            href={d.buttonUrl as string}
            className="inline-block px-8 py-4 rounded-lg font-semibold text-lg transition-transform hover:scale-105"
            style={{ background: textColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : '#015035', color: '#ffffff' }}
          >
            {d.buttonText as string}
          </a>
        </section>
      )
    case 'form':
      return <FormBlock data={d} funnelSlug={funnelSlug} pageId={pageId} />
    case 'video':
      return (
        <section style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="max-w-3xl mx-auto aspect-video rounded-2xl overflow-hidden">
            {(d.videoUrl as string) ? (
              <iframe
                src={d.videoUrl as string}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full bg-black/20 flex items-center justify-center">
                <PlayCircle size={64} className="opacity-40" />
              </div>
            )}
          </div>
        </section>
      )
    case 'faq': {
      const items = (d.items ?? []) as Array<{ question: string; answer: string }>
      return (
        <section style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {items.map((item, i) => (
              <FaqAccordion key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </section>
      )
    }
    case 'footer': {
      const links = (d.links ?? []) as Array<{ label: string; url: string }>
      return (
        <footer style={{ background: bgColor, color: textColor, padding }} className="text-center">
          <p className="font-medium mb-4">{d.companyName as string}</p>
          <div className="flex justify-center gap-6 text-sm mb-6">
            {links.map((l, i) => (
              <a key={i} href={l.url} className="opacity-60 hover:opacity-100 transition-opacity">{l.label}</a>
            ))}
          </div>
          <p className="text-xs opacity-40">&copy; {new Date().getFullYear()} {d.companyName as string}. All rights reserved.</p>
        </footer>
      )
    }
    default:
      return null
  }
}

export default function PublicFunnelPage({ blocks, funnelSlug, pageId }: { blocks: Block[]; funnelSlug: string; pageId: string }) {
  return (
    <div className="min-h-screen">
      {blocks.map((block) => (
        <PublicBlock key={block.id} block={block} funnelSlug={funnelSlug} pageId={pageId} />
      ))}
    </div>
  )
}
