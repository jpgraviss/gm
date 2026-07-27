'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Reason = 'too_many' | 'not_relevant' | 'didnt_sign_up' | 'other'
type View = 'loading' | 'main' | 'done' | 'resubscribed' | 'error'

const REASONS: { value: Reason; label: string }[] = [
  { value: 'too_many', label: 'Too many emails' },
  { value: 'not_relevant', label: 'Content not relevant to me' },
  { value: 'didnt_sign_up', label: "I didn't sign up for this" },
  { value: 'other', label: 'Other' },
]

export default function UnsubscribePage() {
  const params = useParams<{ token: string }>()
  const [view, setView] = useState<View>('loading')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState<Reason>('too_many')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/unsubscribe/${params.token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setFirstName(data.firstName || '')
        setEmail(data.email || '')
        setView('main')
      })
      .catch(() => setView('error'))
  }, [params.token])

  async function handleUnsubscribe() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/unsubscribe/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsubscribe', reason }),
      })
      if (!res.ok) throw new Error('Unsubscribe failed')
      setView('done')
    } catch {
      setView('error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResubscribe() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/unsubscribe/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resubscribe' }),
      })
      if (!res.ok) throw new Error('Resubscribe failed')
      setView('resubscribed')
    } catch {
      setView('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(180deg, #FFF3EA 0%, #e6f0ec 100%)' }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: '#015035' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ fontFamily: "'Syncopate', sans-serif", color: '#015035' }}
          >
            GRAVISS MARKETING
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(1,80,53,0.08)' }}>
          <div className="h-1" style={{ background: '#015035' }} />

          <div className="p-8">
            {view === 'loading' && (
              <div className="flex flex-col items-center py-8">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4"
                  style={{ borderColor: '#015035', borderTopColor: 'transparent' }}
                />
                <p className="text-sm text-gray-500">Loading your preferences...</p>
              </div>
            )}

            {view === 'error' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Link</h2>
                <p className="text-sm text-gray-500">
                  This unsubscribe link is invalid or has expired. If you need help, contact us at{' '}
                  <a href="mailto:support@gravissmarketing.com" className="underline" style={{ color: '#015035' }}>
                    support@gravissmarketing.com
                  </a>
                </p>
              </div>
            )}

            {view === 'main' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {firstName ? `${firstName}, we're sorry to see you go` : "We're sorry to see you go"}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Let us know why, and we&apos;ll take you off our list.
                </p>

                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Reason for unsubscribing
                  </label>
                  <div className="flex flex-col gap-2">
                    {REASONS.map(r => (
                      <label
                        key={r.value}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all"
                        style={{
                          borderColor: reason === r.value ? '#015035' : '#e5e7eb',
                          background: reason === r.value ? '#e6f0ec' : 'white',
                        }}
                      >
                        <input
                          type="radio"
                          name="reason"
                          checked={reason === r.value}
                          onChange={() => setReason(r.value)}
                          className="sr-only"
                        />
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: reason === r.value ? '#015035' : '#d1d5db' }}
                        >
                          {reason === r.value && (
                            <div className="w-2 h-2 rounded-full" style={{ background: '#015035' }} />
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleUnsubscribe}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ background: '#015035' }}
                  onMouseEnter={e => { if (!submitting) (e.target as HTMLElement).style.background = '#01673f' }}
                  onMouseLeave={e => (e.target as HTMLElement).style.background = '#015035'}
                >
                  {submitting ? 'Processing...' : 'Unsubscribe from all emails'}
                </button>
              </>
            )}

            {view === 'done' && (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#e6f0ec' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#015035" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">You&apos;ve been unsubscribed</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {email && <>We won&apos;t send any more emails to <strong>{email}</strong>.</>}
                  {' '}You can close this page.
                </p>
                <button
                  onClick={handleResubscribe}
                  disabled={submitting}
                  className="text-sm font-medium underline transition-colors"
                  style={{ color: '#015035' }}
                >
                  {submitting ? 'Processing...' : 'Changed your mind? Re-subscribe'}
                </button>
              </div>
            )}

            {view === 'resubscribed' && (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#e6f0ec' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#015035" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome back!</h2>
                <p className="text-sm text-gray-500">
                  You&apos;ve been re-subscribed and will continue receiving emails from us. You can close this page.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} Graviss Marketing. All rights reserved.
        </p>
        <p className="text-center text-[10px] text-gray-400 mt-1">
          <a href="https://www.gravissmarketing.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-400 underline hover:text-gray-500">Privacy Policy</a>
          {' · '}
          <a href="https://www.gravissmarketing.com/terms" target="_blank" rel="noopener noreferrer" className="text-gray-400 underline hover:text-gray-500">Terms of Service</a>
        </p>
      </div>
    </div>
  )
}
