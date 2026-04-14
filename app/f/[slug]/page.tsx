'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

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
}

export default function PublicFormPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!slug) return
    fetch(`/api/forms/public/${slug}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setForm)
      .catch(() => setError('This form is no longer available.'))
      .finally(() => setLoading(false))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
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
      if (data.redirectUrl) {
        setTimeout(() => { window.location.href = data.redirectUrl }, 800)
      }
    } catch {
      setError('Network error — please try again')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    )
  }

  if (!form) return null

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#015035" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{form.successMessage}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{form.name}</h1>
        {form.description && (
          <p className="text-sm text-gray-500 mb-6">{form.description}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {form.fields.map(field => (
            <div key={field.id}>
              {field.type !== 'hidden' && (
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  required={field.required}
                  placeholder={field.placeholder}
                  rows={4}
                  value={values[field.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  required={field.required}
                  value={values[field.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={field.name}
                    checked={values[field.name] === 'true'}
                    onChange={e => setValues(v => ({ ...v, [field.name]: e.target.checked ? 'true' : 'false' }))}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">{field.placeholder || field.label}</span>
                </label>
              ) : (
                <input
                  type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : field.type === 'hidden' ? 'hidden' : 'text'}
                  name={field.name}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  className={field.type === 'hidden' ? 'hidden' : 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500'}
                />
              )}

              {field.helpText && field.type !== 'hidden' && (
                <p className="text-[11px] text-gray-400 mt-1">{field.helpText}</p>
              )}
            </div>
          ))}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            {submitting ? 'Submitting…' : form.submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
