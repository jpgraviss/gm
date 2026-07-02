'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface FieldCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty'
  value?: string
}

interface FormField {
  id: string
  type: string
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  helpText?: string
  ratingMax?: number
  conditions?: FieldCondition[]
}

interface PublicForm {
  id: string
  name: string
  description?: string
  fields: FormField[]
  submitLabel: string
  successMessage: string
  redirectUrl?: string
  primaryColor?: string
  textColor?: string
  bgColor?: string
  bgTransparent?: boolean
  fontFamily?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s\-+().]{7,20}$/

function validateFieldLive(type: string, value: string, ratingMax?: number): string | null {
  if (!value) return null
  if (type === 'email' && !EMAIL_RE.test(value)) return 'Enter a valid email address'
  if (type === 'phone') {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone number'
    if (!PHONE_RE.test(value)) return 'Enter a valid phone number'
  }
  if (type === 'url') {
    try { new URL(value) } catch { return 'Enter a valid URL' }
  }
  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Enter a valid date'
  if (type === 'number' && Number.isNaN(Number(value))) return 'Enter a valid number'
  if (type === 'rating') {
    const n = Number(value)
    if (Number.isNaN(n) || n < 1 || n > (ratingMax ?? 5)) return `Rating must be between 1 and ${ratingMax ?? 5}`
  }
  return null
}

function evaluateConditions(conditions: FieldCondition[] | undefined, data: Record<string, string>): boolean {
  if (!conditions || conditions.length === 0) return true
  return conditions.every(c => {
    const val = data[c.field] ?? ''
    switch (c.operator) {
      case 'equals':       return val === (c.value ?? '')
      case 'not_equals':   return val !== (c.value ?? '')
      case 'contains':     return val.includes(c.value ?? '')
      case 'is_empty':     return !val
      case 'is_not_empty': return !!val
      default:             return true
    }
  })
}

function splitPages(fields: FormField[]): FormField[][] {
  const pages: FormField[][] = [[]]
  for (const f of fields) {
    if (f.type === 'page_break') {
      pages.push([])
    } else {
      pages[pages.length - 1].push(f)
    }
  }
  return pages.filter(p => p.length > 0)
}

function SignatureCanvas({ value, onChange, primary }: { value: string; onChange: (v: string) => void; primary: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  function getCtx() {
    const c = canvasRef.current
    return c ? c.getContext('2d') : null
  }

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const c = canvasRef.current
    if (!c) return null
    const rect = c.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    drawing.current = true
    const pos = getPos(e)
    const ctx = getCtx()
    if (pos && ctx) {
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    const pos = getPos(e)
    const ctx = getCtx()
    if (pos && ctx) {
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
  }

  function endDraw() {
    if (!drawing.current) return
    drawing.current = false
    const c = canvasRef.current
    if (c) onChange(c.toDataURL('image/png'))
  }

  function clear() {
    const c = canvasRef.current
    const ctx = getCtx()
    if (c && ctx) {
      ctx.clearRect(0, 0, c.width, c.height)
      onChange('')
    }
  }

  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const ctx = getCtx()
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          ctx.drawImage(img, 0, 0)
        }
      }
      img.src = value
    }
    // Only restore on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={460}
        height={120}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{ width: '100%', maxWidth: 460, height: 120, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa', cursor: 'crosshair', touchAction: 'none' }}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          style={{ marginTop: 6, fontSize: 11, color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          Clear signature
        </button>
      )}
    </div>
  )
}

function StarRating({ value, max, onChange, primary }: { value: number; max: number; onChange: (v: number) => void; primary: string }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 24, lineHeight: 1, color: n <= (hover || value) ? primary : '#d1d5db', transition: 'color 0.15s, transform 0.1s', transform: n <= (hover || value) ? 'scale(1.1)' : 'scale(1)' }}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function PublicFormPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const isEmbed = searchParams?.get('embed') === '1'
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/forms/public/${slug}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: PublicForm) => {
        setForm(data)
        // Pre-fill from URL params
        const prefill: Record<string, string> = {}
        data.fields.forEach(f => {
          const param = searchParams?.get(f.name)
          if (param) prefill[f.name] = param
          if (f.type === 'hidden' && f.placeholder && !param) prefill[f.name] = f.placeholder
        })
        if (Object.keys(prefill).length > 0) setValues(v => ({ ...v, ...prefill }))
      })
      .catch(() => setError('This form is no longer available.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const handleChange = useCallback((name: string, type: string, value: string, ratingMax?: number) => {
    setValues(v => ({ ...v, [name]: value }))
    if (touched[name]) {
      const err = validateFieldLive(type, value, ratingMax)
      setFieldErrors(prev => {
        if (err) return { ...prev, [name]: err }
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }, [touched])

  const handleBlur = useCallback((name: string, type: string, value: string, ratingMax?: number) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    const err = validateFieldLive(type, value, ratingMax)
    setFieldErrors(prev => {
      if (err) return { ...prev, [name]: err }
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  useEffect(() => {
    const send = () => {
      window.parent?.postMessage({ type: 'gravhub:resize', height: document.body.scrollHeight }, '*')
    }
    send()
    const observer = new ResizeObserver(send)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [form, success, currentPage])

  const pages = form ? splitPages(form.fields) : [[]]
  const isMultiPage = pages.length > 1
  const visibleFields = isMultiPage ? (pages[currentPage] ?? []) : (form?.fields ?? []).filter(f => f.type !== 'page_break')
  const isLastPage = currentPage >= pages.length - 1

  function validateCurrentPage(): boolean {
    if (!form) return false
    const errors: Record<string, string> = {}
    for (const field of visibleFields) {
      if (field.type === 'page_break' || field.type === 'hidden') continue
      if (!evaluateConditions(field.conditions, values)) continue
      const v = values[field.name] ?? ''
      if (field.required && !v) errors[field.name] = `${field.label} is required`
      const liveErr = validateFieldLive(field.type, v, field.ratingMax)
      if (liveErr && v) errors[field.name] = liveErr
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...errors }))
      setTouched(prev => {
        const next = { ...prev }
        visibleFields.forEach(f => { next[f.name] = true })
        return next
      })
      return false
    }
    return true
  }

  function handleNext() {
    if (validateCurrentPage()) {
      setCurrentPage(p => Math.min(p + 1, pages.length - 1))
      setError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    if (!validateCurrentPage()) {
      setError('Please fix the errors above')
      return
    }

    // Also validate all pages for safety
    const allFields = form.fields.filter(f => f.type !== 'page_break')
    const errors: Record<string, string> = {}
    for (const field of allFields) {
      if (field.type === 'hidden') continue
      if (!evaluateConditions(field.conditions, values)) continue
      const v = values[field.name] ?? ''
      if (field.required && !v) errors[field.name] = `${field.label} is required`
      const liveErr = validateFieldLive(field.type, v, field.ratingMax)
      if (liveErr && v) errors[field.name] = liveErr
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setTouched(Object.fromEntries(allFields.map(f => [f.name, true])))
      setError('Please fix the errors above')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forms/public/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Submission failed')
        setSubmitting(false)
        return
      }
      setSuccess(true)
      if (isEmbed) {
        window.parent?.postMessage({ type: 'gravhub:submitted' }, '*')
      }
      if (data.redirectUrl && !isEmbed) {
        setTimeout(() => { window.location.href = data.redirectUrl }, 800)
      }
    } catch {
      setError('Network error — please try again')
      setSubmitting(false)
    }
  }

  const primary = form?.primaryColor || '#015035'
  const textCol = form?.textColor || '#111827'
  const bgCol = form?.bgTransparent ? 'transparent' : (form?.bgColor || '#f9fafb')
  const font = form?.fontFamily || 'system-ui, -apple-system, sans-serif'

  if (loading) {
    return (
      <div style={{ minHeight: isEmbed ? 'auto' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isEmbed ? 'transparent' : bgCol, fontFamily: font, padding: isEmbed ? 24 : 0 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div style={{ minHeight: isEmbed ? 'auto' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isEmbed ? 'transparent' : bgCol, fontFamily: font, padding: 24 }}>
        <p style={{ fontSize: 14, color: '#6b7280' }}>{error}</p>
      </div>
    )
  }

  if (!form) return null

  if (success) {
    return (
      <div style={{ minHeight: isEmbed ? 'auto' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isEmbed ? 'transparent' : bgCol, fontFamily: font, padding: 24 }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `${primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: textCol, marginBottom: 8 }}>{form.successMessage}</h1>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: isEmbed ? 'auto' : '100vh', background: isEmbed ? 'transparent' : bgCol, padding: isEmbed ? '12px 4px' : '48px 16px', fontFamily: font }}>
      <div style={{ maxWidth: isEmbed ? '100%' : 520, margin: '0 auto', background: isEmbed ? 'transparent' : (form.bgTransparent ? 'transparent' : '#ffffff'), borderRadius: isEmbed ? 0 : (form.bgTransparent ? 0 : 16), boxShadow: isEmbed ? 'none' : (form.bgTransparent ? 'none' : '0 1px 3px rgba(0,0,0,0.08)'), border: isEmbed ? 'none' : (form.bgTransparent ? 'none' : '1px solid #e5e7eb'), padding: isEmbed ? '0 12px' : (form.bgTransparent ? '0' : '24px 32px') }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: textCol, marginBottom: 4 }}>{form.name}</h1>
        {form.description && (
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{form.description}</p>
        )}

        {isMultiPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {pages.map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: i <= currentPage ? primary : '#e5e7eb',
                  color: i <= currentPage ? '#fff' : '#9ca3af',
                  transition: 'all 0.2s'
                }}>
                  {i + 1}
                </div>
                {i < pages.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < currentPage ? primary : '#e5e7eb', borderRadius: 1, transition: 'background 0.2s' }} />
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visibleFields.map(field => {
            const fieldErr = fieldErrors[field.name]
            const isTouched = touched[field.name]
            const val = values[field.name] ?? ''
            const hasError = isTouched && fieldErr
            const borderColor = hasError ? '#ef4444' : '#e5e7eb'

            if (field.type === 'page_break') return null
            if (!evaluateConditions(field.conditions, values)) return null

            if (field.type === 'hidden') {
              return <input key={field.id} type="hidden" name={field.name} value={val} />
            }

            return (
              <div key={field.id}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                  {field.label}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    name={field.name}
                    placeholder={field.placeholder}
                    rows={4}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    onBlur={() => handleBlur(field.name, field.type, val)}
                    style={{ width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', outline: 'none', fontFamily: font, resize: 'vertical' }}
                  />
                ) : field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    style={{ width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', background: '#fff', fontFamily: font }}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'multi_select' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(field.options ?? []).map(opt => {
                      const selected = val.split(',').filter(Boolean)
                      const isChecked = selected.includes(opt)
                      return (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: `1px solid ${isChecked ? primary : '#e5e7eb'}`, borderRadius: 10, background: isChecked ? `${primary}08` : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = isChecked ? selected.filter(s => s !== opt) : [...selected, opt]
                              handleChange(field.name, field.type, next.join(','))
                            }}
                            style={{ width: 16, height: 16, borderRadius: 4, accentColor: primary }}
                          />
                          <span style={{ fontSize: 14, color: textCol }}>{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      name={field.name}
                      checked={val === 'true'}
                      onChange={e => handleChange(field.name, field.type, e.target.checked ? 'true' : 'false')}
                      style={{ width: 16, height: 16, borderRadius: 4, accentColor: primary }}
                    />
                    <span style={{ fontSize: 14, color: textCol }}>{field.placeholder || field.label}</span>
                  </label>
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    name={field.name}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    onBlur={() => handleBlur(field.name, field.type, val)}
                    style={{ width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', outline: 'none', fontFamily: font }}
                  />
                ) : field.type === 'rating' ? (
                  <StarRating
                    value={Number(val) || 0}
                    max={field.ratingMax ?? 5}
                    onChange={n => handleChange(field.name, field.type, String(n), field.ratingMax)}
                    primary={primary}
                  />
                ) : field.type === 'signature' ? (
                  <SignatureCanvas
                    value={val}
                    onChange={v => handleChange(field.name, field.type, v)}
                    primary={primary}
                  />
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                    name={field.name}
                    placeholder={field.placeholder}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    onBlur={() => handleBlur(field.name, field.type, val)}
                    style={{ width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', outline: 'none', fontFamily: font }}
                  />
                )}

                {hasError && (
                  <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErr}</p>
                )}

                {field.helpText && (
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{field.helpText}</p>
                )}
              </div>
            )
          })}

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '8px 12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {isMultiPage && currentPage > 0 && (
              <button
                type="button"
                onClick={() => { setCurrentPage(p => p - 1); setError('') }}
                style={{ flex: 1, padding: '14px 0', borderRadius: 12, color: primary, fontSize: 14, fontWeight: 600, border: `2px solid ${primary}`, cursor: 'pointer', background: '#fff', fontFamily: font }}
              >
                Back
              </button>
            )}
            {isMultiPage && !isLastPage ? (
              <button
                type="button"
                onClick={handleNext}
                style={{ flex: 2, padding: '14px 0', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', background: primary, fontFamily: font }}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 2, padding: '14px 0', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, background: primary, fontFamily: font }}
              >
                {submitting ? 'Submitting…' : form.submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
