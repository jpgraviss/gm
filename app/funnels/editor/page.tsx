'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Save, Eye, EyeOff, Upload, ArrowUp, ArrowDown, Trash2, X,
  Type, LayoutGrid, MessageSquare, MousePointerClick, FileText,
  PlayCircle, HelpCircle, Copyright, ChevronDown, ChevronUp,
  Layers, Plus, GripVertical,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type BlockType = 'hero' | 'features' | 'testimonials' | 'cta' | 'form' | 'video' | 'faq' | 'footer'

interface Block {
  id: string
  type: BlockType
  data: Record<string, unknown>
}

interface PageData {
  id: string
  name: string
  blocks: Block[]
  funnel_id: string
}

const BLOCK_TYPES: Array<{ type: BlockType; label: string; icon: React.ReactNode; description: string }> = [
  { type: 'hero', label: 'Hero', icon: <Type size={16} />, description: 'Headline, subheadline, CTA' },
  { type: 'features', label: 'Features', icon: <LayoutGrid size={16} />, description: '3-column feature grid' },
  { type: 'testimonials', label: 'Testimonials', icon: <MessageSquare size={16} />, description: 'Client testimonials' },
  { type: 'cta', label: 'CTA', icon: <MousePointerClick size={16} />, description: 'Call-to-action banner' },
  { type: 'form', label: 'Form', icon: <FileText size={16} />, description: 'Lead capture form' },
  { type: 'video', label: 'Video', icon: <PlayCircle size={16} />, description: 'Video embed section' },
  { type: 'faq', label: 'FAQ', icon: <HelpCircle size={16} />, description: 'Accordion FAQ' },
  { type: 'footer', label: 'Footer', icon: <Copyright size={16} />, description: 'Footer with links' },
]

function defaultBlockData(type: BlockType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return {
        headline: 'Transform Your Business Today',
        subheadline: 'Join thousands of companies that have already made the switch.',
        buttonText: 'Get Started',
        buttonUrl: '#',
        bgColor: '#015035',
        textColor: '#ffffff',
        imageUrl: '',
        padding: '80',
      }
    case 'features':
      return {
        heading: 'Why Choose Us',
        features: [
          { icon: 'zap', title: 'Lightning Fast', description: 'Get results in days, not months.' },
          { icon: 'shield', title: 'Secure & Reliable', description: 'Enterprise-grade security built in.' },
          { icon: 'trending-up', title: 'Growth Focused', description: 'Tools designed to scale with you.' },
        ],
        bgColor: '#ffffff',
        textColor: '#111827',
        padding: '60',
      }
    case 'testimonials':
      return {
        heading: 'What Our Clients Say',
        testimonials: [
          { name: 'Sarah Johnson', role: 'CEO, TechCorp', quote: 'Absolutely transformed our workflow.' },
          { name: 'Mike Chen', role: 'Marketing Director', quote: 'The best investment we made this year.' },
          { name: 'Lisa Park', role: 'Founder, StartupXYZ', quote: 'Results exceeded our expectations.' },
        ],
        bgColor: '#f9fafb',
        textColor: '#111827',
        padding: '60',
      }
    case 'cta':
      return {
        headline: 'Ready to Get Started?',
        subheadline: 'Sign up today and see the difference.',
        buttonText: 'Start Free Trial',
        buttonUrl: '#',
        bgColor: '#015035',
        textColor: '#ffffff',
        padding: '60',
      }
    case 'form':
      return {
        heading: 'Get In Touch',
        subheadline: 'Fill out the form and we\'ll get back to you within 24 hours.',
        fields: [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'message', label: 'Message', type: 'textarea', required: false },
        ],
        buttonText: 'Submit',
        bgColor: '#ffffff',
        textColor: '#111827',
        padding: '60',
      }
    case 'video':
      return {
        heading: 'See It In Action',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        bgColor: '#111827',
        textColor: '#ffffff',
        padding: '60',
      }
    case 'faq':
      return {
        heading: 'Frequently Asked Questions',
        items: [
          { question: 'How does it work?', answer: 'Simply sign up, connect your tools, and start seeing results.' },
          { question: 'What is the pricing?', answer: 'We offer flexible plans starting at $29/month.' },
          { question: 'Can I cancel anytime?', answer: 'Yes, there are no long-term contracts.' },
        ],
        bgColor: '#ffffff',
        textColor: '#111827',
        padding: '60',
      }
    case 'footer':
      return {
        companyName: 'Your Company',
        links: [
          { label: 'Privacy Policy', url: '#' },
          { label: 'Terms of Service', url: '#' },
          { label: 'Contact', url: '#' },
        ],
        bgColor: '#111827',
        textColor: '#9ca3af',
        padding: '40',
      }
  }
}

function BlockPreview({ block }: { block: Block }) {
  const d = block.data
  const padding = `${d.padding ?? '60'}px`
  const bgColor = (d.bgColor as string) ?? '#ffffff'
  const textColor = (d.textColor as string) ?? '#111827'

  switch (block.type) {
    case 'hero':
      return (
        <div style={{ background: bgColor, color: textColor, padding }} className="text-center">
          {(d.imageUrl as string) && (
            <img src={d.imageUrl as string} alt="" className="max-h-32 mx-auto mb-6 rounded-lg object-cover" />
          )}
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)' }}>{d.headline as string}</h1>
          <p className="text-lg opacity-80 mb-6 max-w-xl mx-auto">{d.subheadline as string}</p>
          <button className="px-6 py-3 rounded-lg font-semibold text-white" style={{ background: textColor === '#ffffff' ? '#ffffff30' : '#015035' }}>
            {d.buttonText as string}
          </button>
        </div>
      )
    case 'features': {
      const features = (d.features ?? []) as Array<{ icon: string; title: string; description: string }>
      return (
        <div style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
            {features.map((f, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center" style={{ background: '#01503520' }}>
                  <LayoutGrid size={18} style={{ color: '#015035' }} />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm opacity-70">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'testimonials': {
      const testimonials = (d.testimonials ?? []) as Array<{ name: string; role: string; quote: string }>
      return (
        <div style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <div key={i} className="p-5 rounded-xl border border-gray-200/50" style={{ background: `${bgColor}dd` }}>
                <p className="text-sm mb-4 italic">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs opacity-60">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'cta':
      return (
        <div style={{ background: bgColor, color: textColor, padding }} className="text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{d.headline as string}</h2>
          <p className="opacity-80 mb-6">{d.subheadline as string}</p>
          <button className="px-6 py-3 rounded-lg font-semibold" style={{ background: textColor === '#ffffff' ? '#ffffff20' : '#015035', color: textColor === '#ffffff' ? '#ffffff' : '#ffffff' }}>
            {d.buttonText as string}
          </button>
        </div>
      )
    case 'form': {
      const fields = (d.fields ?? []) as Array<{ name: string; label: string; type: string; required: boolean }>
      return (
        <div style={{ background: bgColor, color: textColor, padding }}>
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
            <p className="text-center opacity-70 text-sm mb-6">{d.subheadline as string}</p>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium mb-1">{f.label}{f.required && ' *'}</label>
                  {f.type === 'textarea' ? (
                    <div className="w-full h-20 rounded-lg border border-gray-200 bg-gray-50" />
                  ) : (
                    <div className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50" />
                  )}
                </div>
              ))}
              <button className="w-full py-3 rounded-lg font-semibold text-white" style={{ background: '#015035' }}>
                {d.buttonText as string}
              </button>
            </div>
          </div>
        </div>
      )
    }
    case 'video':
      return (
        <div style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl font-bold text-center mb-6" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden bg-black/20">
            <div className="w-full h-full flex items-center justify-center">
              <PlayCircle size={48} className="opacity-40" />
            </div>
          </div>
        </div>
      )
    case 'faq': {
      const items = (d.items ?? []) as Array<{ question: string; answer: string }>
      return (
        <div style={{ background: bgColor, color: textColor, padding }}>
          <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: 'var(--font-heading)' }}>{d.heading as string}</h2>
          <div className="max-w-2xl mx-auto space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-gray-200/50 rounded-lg p-4">
                <p className="font-semibold text-sm">{item.question}</p>
                <p className="text-sm opacity-70 mt-1">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    case 'footer': {
      const links = (d.links ?? []) as Array<{ label: string; url: string }>
      return (
        <div style={{ background: bgColor, color: textColor, padding }} className="text-center">
          <p className="text-sm font-medium mb-3">{d.companyName as string}</p>
          <div className="flex justify-center gap-4 text-xs">
            {links.map((l, i) => (
              <span key={i} className="opacity-60 hover:opacity-100 cursor-pointer">{l.label}</span>
            ))}
          </div>
          <p className="text-xs opacity-40 mt-4">&copy; {new Date().getFullYear()} {d.companyName as string}. All rights reserved.</p>
        </div>
      )
    }
  }
}

function BlockSettings({
  block,
  onChange,
}: {
  block: Block
  onChange: (data: Record<string, unknown>) => void
}) {
  const d = block.data
  const update = (key: string, value: unknown) => onChange({ ...d, [key]: value })

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{block.type} settings</p>

      {/* Common text fields based on block type */}
      {(d.headline !== undefined) && (
        <Field label="Headline" value={d.headline as string} onChange={(v) => update('headline', v)} />
      )}
      {(d.heading !== undefined) && (
        <Field label="Heading" value={d.heading as string} onChange={(v) => update('heading', v)} />
      )}
      {(d.subheadline !== undefined) && (
        <Field label="Subheadline" value={d.subheadline as string} onChange={(v) => update('subheadline', v)} textarea />
      )}
      {(d.buttonText !== undefined) && (
        <Field label="Button Text" value={d.buttonText as string} onChange={(v) => update('buttonText', v)} />
      )}
      {(d.buttonUrl !== undefined) && (
        <Field label="Button URL" value={d.buttonUrl as string} onChange={(v) => update('buttonUrl', v)} />
      )}
      {(d.imageUrl !== undefined) && (
        <Field label="Image URL" value={d.imageUrl as string} onChange={(v) => update('imageUrl', v)} />
      )}
      {(d.videoUrl !== undefined) && (
        <Field label="Video Embed URL" value={d.videoUrl as string} onChange={(v) => update('videoUrl', v)} />
      )}
      {(d.companyName !== undefined) && (
        <Field label="Company Name" value={d.companyName as string} onChange={(v) => update('companyName', v)} />
      )}

      {/* Array editors */}
      {block.type === 'features' && (
        <FeaturesEditor
          features={(d.features ?? []) as Array<{ icon: string; title: string; description: string }>}
          onChange={(v) => update('features', v)}
        />
      )}
      {block.type === 'testimonials' && (
        <TestimonialsEditor
          testimonials={(d.testimonials ?? []) as Array<{ name: string; role: string; quote: string }>}
          onChange={(v) => update('testimonials', v)}
        />
      )}
      {block.type === 'faq' && (
        <FaqEditor
          items={(d.items ?? []) as Array<{ question: string; answer: string }>}
          onChange={(v) => update('items', v)}
        />
      )}
      {block.type === 'form' && (
        <FormFieldsEditor
          fields={(d.fields ?? []) as Array<{ name: string; label: string; type: string; required: boolean }>}
          onChange={(v) => update('fields', v)}
        />
      )}
      {block.type === 'footer' && (
        <LinksEditor
          links={(d.links ?? []) as Array<{ label: string; url: string }>}
          onChange={(v) => update('links', v)}
        />
      )}

      <div className="border-t border-gray-200 dark:border-white/10 pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Style</p>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Background" value={(d.bgColor as string) ?? '#ffffff'} onChange={(v) => update('bgColor', v)} />
          <ColorField label="Text" value={(d.textColor as string) ?? '#111827'} onChange={(v) => update('textColor', v)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Padding (px)</label>
          <input
            type="range"
            min="20"
            max="120"
            value={d.padding as string ?? '60'}
            onChange={(e) => update('padding', e.target.value)}
            className="w-full"
          />
          <span className="text-xs text-gray-400">{String(d.padding ?? '60')}px</span>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm" />
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-mono" />
      </div>
    </div>
  )
}

function FeaturesEditor({ features, onChange }: { features: Array<{ icon: string; title: string; description: string }>; onChange: (v: Array<{ icon: string; title: string; description: string }>) => void }) {
  const update = (i: number, key: string, val: string) => {
    const next = [...features]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Features</p>
      {features.map((f, i) => (
        <div key={i} className="space-y-1.5 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
          <input value={f.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Title" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <input value={f.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Description" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <button onClick={() => onChange(features.filter((_, j) => j !== i))} className="text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange([...features, { icon: 'star', title: 'New Feature', description: 'Description' }])} className="text-xs text-[#015035] font-medium flex items-center gap-1"><Plus size={10} /> Add feature</button>
    </div>
  )
}

function TestimonialsEditor({ testimonials, onChange }: { testimonials: Array<{ name: string; role: string; quote: string }>; onChange: (v: Array<{ name: string; role: string; quote: string }>) => void }) {
  const update = (i: number, key: string, val: string) => {
    const next = [...testimonials]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Testimonials</p>
      {testimonials.map((t, i) => (
        <div key={i} className="space-y-1.5 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
          <input value={t.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Name" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <input value={t.role} onChange={(e) => update(i, 'role', e.target.value)} placeholder="Role" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <textarea value={t.quote} onChange={(e) => update(i, 'quote', e.target.value)} placeholder="Quote" rows={2} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <button onClick={() => onChange(testimonials.filter((_, j) => j !== i))} className="text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange([...testimonials, { name: 'New Client', role: 'Position', quote: 'Great product!' }])} className="text-xs text-[#015035] font-medium flex items-center gap-1"><Plus size={10} /> Add testimonial</button>
    </div>
  )
}

function FaqEditor({ items, onChange }: { items: Array<{ question: string; answer: string }>; onChange: (v: Array<{ question: string; answer: string }>) => void }) {
  const update = (i: number, key: string, val: string) => {
    const next = [...items]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">FAQ Items</p>
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
          <input value={item.question} onChange={(e) => update(i, 'question', e.target.value)} placeholder="Question" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <textarea value={item.answer} onChange={(e) => update(i, 'answer', e.target.value)} placeholder="Answer" rows={2} className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { question: 'New question?', answer: 'Answer here.' }])} className="text-xs text-[#015035] font-medium flex items-center gap-1"><Plus size={10} /> Add item</button>
    </div>
  )
}

function FormFieldsEditor({ fields, onChange }: { fields: Array<{ name: string; label: string; type: string; required: boolean }>; onChange: (v: Array<{ name: string; label: string; type: string; required: boolean }>) => void }) {
  const update = (i: number, key: string, val: unknown) => {
    const next = [...fields]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Form Fields</p>
      {fields.map((f, i) => (
        <div key={i} className="space-y-1.5 p-2 rounded-lg bg-gray-50 dark:bg-white/5">
          <input value={f.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" className="w-full px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <div className="flex gap-2">
            <select value={f.type} onChange={(e) => update(i, 'type', e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5">
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="textarea">Textarea</option>
              <option value="select">Select</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input type="checkbox" checked={f.required} onChange={(e) => update(i, 'required', e.target.checked)} />
              Required
            </label>
          </div>
          <button onClick={() => onChange(fields.filter((_, j) => j !== i))} className="text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ))}
      <button onClick={() => onChange([...fields, { name: `field_${fields.length}`, label: 'New Field', type: 'text', required: false }])} className="text-xs text-[#015035] font-medium flex items-center gap-1"><Plus size={10} /> Add field</button>
    </div>
  )
}

function LinksEditor({ links, onChange }: { links: Array<{ label: string; url: string }>; onChange: (v: Array<{ label: string; url: string }>) => void }) {
  const update = (i: number, key: string, val: string) => {
    const next = [...links]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Links</p>
      {links.map((l, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input value={l.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Label" className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <input value={l.url} onChange={(e) => update(i, 'url', e.target.value)} placeholder="URL" className="flex-1 px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-xs bg-white dark:bg-white/5" />
          <button onClick={() => onChange(links.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...links, { label: 'Link', url: '#' }])} className="text-xs text-[#015035] font-medium flex items-center gap-1"><Plus size={10} /> Add link</button>
    </div>
  )
}

function EditorInner() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const funnelId = searchParams.get('funnel')
  const pageId = searchParams.get('page')

  const [page, setPage] = useState<PageData | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pageName, setPageName] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'blocks' | 'settings' | null>(null)

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null

  useEffect(() => {
    if (!funnelId || !pageId) return
    loadPage()
  }, [funnelId, pageId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPage() {
    try {
      const res = await fetch(`/api/funnels/${funnelId}`)
      if (!res.ok) return
      const data = await res.json()
      const pg = (data.pages as PageData[])?.find((p) => p.id === pageId)
      if (pg) {
        setPage(pg)
        setBlocks(pg.blocks ?? [])
        setPageName(pg.name)
      }
    } finally {
      setLoading(false)
    }
  }

  const addBlock = useCallback((type: BlockType) => {
    const newBlock: Block = {
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      data: defaultBlockData(type),
    }
    setBlocks((prev) => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
  }, [])

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0) return prev
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }, [])

  const deleteBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedBlockId === id) setSelectedBlockId(null)
  }, [selectedBlockId])

  const updateBlockData = useCallback((id: string, data: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)))
  }, [])

  async function save() {
    if (!funnelId || !pageId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, blocks, name: pageName }),
      })
      if (res.ok) toast('Page saved', 'success')
      else toast('Failed to save page', 'error')
    } catch {
      toast('Failed to save page', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!funnelId || !pageId) return
    setPublishing(true)
    try {
      await fetch(`/api/funnels/${funnelId}/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, blocks, name: pageName }),
      })
      const res = await fetch(`/api/funnels/${funnelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Published' }),
      })
      if (res.ok) toast('Funnel published', 'success')
      else toast('Failed to publish funnel', 'error')
    } catch {
      toast('Failed to publish funnel', 'error')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-400">Loading editor...</div>
  }

  if (!funnelId || !pageId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Layers size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm mb-4">No page selected. Go to Funnels and choose a page to edit.</p>
          <button onClick={() => router.push('/funnels')} className="text-sm text-[#015035] font-medium hover:underline">Back to Funnels</button>
        </div>
      </div>
    )
  }

  if (preview) {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-50 bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">Preview: {pageName}</span>
          <button onClick={() => setPreview(false)} className="flex items-center gap-1.5 text-sm hover:text-gray-300">
            <EyeOff size={14} /> Exit Preview
          </button>
        </div>
        <div>
          {blocks.map((block) => (
            <BlockPreview key={block.id} block={block} />
          ))}
          {blocks.length === 0 && (
            <div className="py-20 text-center text-gray-400 text-sm">No blocks added yet.</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 px-3 md:px-4 py-2.5 flex items-center gap-2 md:gap-3 z-10 flex-shrink-0">
        <button onClick={() => router.push('/funnels')} className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0">
          &larr; <span className="hidden sm:inline">Funnels</span>
        </button>
        <div className="h-4 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />
        <input
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
          className="text-sm font-medium bg-transparent border-0 outline-none flex-1 min-w-0 text-gray-900 dark:text-white"
        />
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded hidden md:block"
        >
          {sidebarCollapsed ? 'Show panels' : 'Hide panels'}
        </button>
        <button onClick={() => setPreview(true)} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5">
          <Eye size={13} /> <span className="hidden sm:inline">Preview</span>
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50">
          <Save size={13} /> <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
        </button>
        <button onClick={publish} disabled={publishing} className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 text-xs rounded-lg text-white font-medium disabled:opacity-50" style={{ background: '#015035' }}>
          <Upload size={13} /> <span className="hidden sm:inline">{publishing ? 'Publishing...' : 'Publish'}</span>
        </button>
      </div>

      {/* Mobile block palette bar */}
      <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => addBlock(bt.type)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex-shrink-0 min-h-[44px]"
          >
            {bt.icon}
            {bt.label}
          </button>
        ))}
      </div>

      {/* Mobile action buttons */}
      {selectedBlock && (
        <div className="md:hidden flex items-center justify-end gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setMobilePanel('settings')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600"
          >
            Settings
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar - block palette (desktop) */}
        {!sidebarCollapsed && (
          <div className="hidden md:block w-60 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-white/10 overflow-y-auto p-3 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3 px-1">Add Blocks</p>
            <div className="space-y-1.5">
              {BLOCK_TYPES.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => addBlock(bt.type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-white dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 group-hover:text-[#015035] transition-colors">
                    {bt.icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700 dark:text-white/80">{bt.label}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/30">{bt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Center canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950">
          <div className="max-w-4xl mx-auto my-4 md:my-6 px-3 md:px-0">
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl py-12 md:py-20 text-center">
                <Layers size={32} className="mx-auto text-gray-300 dark:text-white/20 mb-3" />
                <p className="text-sm text-gray-400 px-4">
                  <span className="hidden md:inline">Click a block from the left panel to add it to your page.</span>
                  <span className="md:hidden">Tap a block above to add it to your page.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-white/10">
                {blocks.map((block, i) => (
                  <div
                    key={block.id}
                    className={`relative group cursor-pointer ${selectedBlockId === block.id ? 'ring-2 ring-[#015035] ring-offset-1' : ''}`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <BlockPreview block={block} />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-200 dark:border-white/10">
                      <span className="text-[10px] text-gray-400 px-1.5 font-medium">{block.type}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up') }}
                        disabled={i === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down') }}
                        disabled={i === blocks.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteBlock(block.id) }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel - block settings (desktop) */}
        {!sidebarCollapsed && (
          <div className="hidden md:block w-[300px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 overflow-y-auto p-4 flex-shrink-0">
            {selectedBlock ? (
              <BlockSettings
                block={selectedBlock}
                onChange={(data) => updateBlockData(selectedBlock.id, data)}
              />
            ) : (
              <div className="text-center py-12">
                <GripVertical size={24} className="mx-auto text-gray-300 dark:text-white/20 mb-2" />
                <p className="text-xs text-gray-400">Select a block to edit its settings</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile settings overlay */}
      {mobilePanel === 'settings' && selectedBlock && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobilePanel(null)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">Block Settings</p>
              <button onClick={() => setMobilePanel(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <BlockSettings
              block={selectedBlock}
              onChange={(data) => updateBlockData(selectedBlock.id, data)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function FunnelEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-gray-400">Loading editor...</div>}>
      <EditorInner />
    </Suspense>
  )
}
