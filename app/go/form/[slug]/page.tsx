'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface FormField {
  id: string
  type: string
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  helpText?: string
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

function validateFieldLive(type: string, value: string): string | null {
  if (!value) return null
  if (type === 'email' && !EMAIL_RE.test(value)) return 'Enter a valid email address'
  if (type === 'phone') {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone number'
    if (!PHONE_RE.test(value)) return 'Enter a valid phone number'
  }
  return null
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

  useEffect(() => {
    if (!slug) return
    fetch(`/api/forms/public/${slug}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setForm)
      .catch(() => setError('This form is no longer available.'))
      .finally(() => setLoading(false))
  }, [slug])

  const handleChange = useCallback((name: string, type: string, value: string) => {
    setValues(v => ({ ...v, [name]: value }))
    if (touched[name]) {
      const err = validateFieldLive(type, value)
      setFieldErrors(prev => {
        if (err) return { ...prev, [name]: err }
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }, [touched])

  const handleBlur = useCallback((name: string, type: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    const err = validateFieldLive(type, value)
    setFieldErrors(prev => {
      if (err) return { ...prev, [name]: err }
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // Post height to parent for iframe auto-resize
  useEffect(() => {
    const send = () => {
      window.parent?.postMessage({ type: 'gravhub:resize', height: document.body.scrollHeight }, '*')
    }
    send()
    const observer = new ResizeObserver(send)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [form, success])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    // Validate all fields
    const errors: Record<string, string> = {}
    for (const field of form.fields) {
      const v = values[field.name] ?? ''
      if (field.required && !v) errors[field.name] = `${field.label} is required`
      const liveErr = validateFieldLive(field.type, v)
      if (liveErr && v) errors[field.name] = liveErr
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setTouched(Object.fromEntries(form.fields.map(f => [f.name, true])))
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

  // Styling
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {form.fields.map(field => {
            const fieldErr = fieldErrors[field.name]
            const isTouched = touched[field.name]
            const val = values[field.name] ?? ''
            const hasError = isTouched && fieldErr
            const borderColor = hasError ? '#ef4444' : '#e5e7eb'

            return (
              <div key={field.id}>
                {field.type !== 'hidden' && (
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                    {field.label}
                    {field.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                  </label>
                )}

                {field.type === 'textarea' ? (
                  <textarea
                    name={field.name}
                    required={field.required}
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
                    required={field.required}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    style={{ width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', background: '#fff', fontFamily: font }}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
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
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : field.type === 'hidden' ? 'hidden' : 'text'}
                    name={field.name}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={val}
                    onChange={e => handleChange(field.name, field.type, e.target.value)}
                    onBlur={() => handleBlur(field.name, field.type, val)}
                    style={field.type === 'hidden' ? { display: 'none' } : { width: '100%', fontSize: 14, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '10px 12px', outline: 'none', fontFamily: font }}
                  />
                )}

                {hasError && (
                  <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErr}</p>
                )}

                {field.helpText && field.type !== 'hidden' && (
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{field.helpText}</p>
                )}
              </div>
            )
          })}

          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '8px 12px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{ marginTop: 8, padding: '14px 0', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, background: primary, fontFamily: font }}
          >
            {submitting ? 'Submitting…' : form.submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
