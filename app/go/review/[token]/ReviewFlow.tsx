'use client'

import { useState } from 'react'

interface Props {
  token: string
  customerName: string
  companyName: string
  alreadyCompleted: boolean
}

function StarIcon({ filled, size = 48 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? '#fbbf24' : 'none'}
      stroke={filled ? '#fbbf24' : '#d1d5db'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#015035" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

export default function ReviewFlow({ token, customerName, companyName, alreadyCompleted }: Props) {
  const [step, setStep] = useState<'rate' | 'feedback' | 'redirect' | 'done'>(
    alreadyCompleted ? 'done' : 'rate'
  )
  const [hoveredStar, setHoveredStar] = useState(0)
  const [selectedRating, setSelectedRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = customerName.split(' ')[0]

  async function handleRatingSelect(rating: number) {
    setSelectedRating(rating)
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/reputation/review-request/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setSubmitting(false)
        return
      }

      if (data.isPositive && data.googleReviewUrl) {
        // 4-5 stars: redirect to Google Business Profile
        setStep('redirect')
        setTimeout(() => {
          window.location.href = data.googleReviewUrl
        }, 2000)
      } else if (data.isPositive) {
        // 4-5 stars but no Google URL configured
        setStep('done')
      } else {
        // 1-3 stars: show internal feedback form
        setStep('feedback')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFeedbackSubmit() {
    if (!feedback.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/reputation/review-request/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selectedRating, feedback: feedback.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        return
      }

      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #f5f5f4 100%)',
      padding: '24px 16px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        {/* Brand header bar */}
        <div style={{
          background: '#015035',
          padding: '24px 32px',
          textAlign: 'center',
        }}>
          <h1 style={{
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 700,
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            {companyName}
          </h1>
        </div>

        <div style={{ padding: '32px 32px 40px' }}>
          {/* STEP: Rate */}
          {step === 'rate' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 8px',
              }}>
                Hi {firstName}!
              </h2>
              <p style={{
                fontSize: 15,
                color: '#6b7280',
                margin: '0 0 32px',
                lineHeight: 1.6,
              }}>
                How was your experience with us?<br />
                Tap a star to rate.
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 24,
              }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingSelect(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    disabled={submitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: submitting ? 'wait' : 'pointer',
                      padding: 4,
                      transition: 'transform 0.15s ease',
                      transform: (hoveredStar >= star || selectedRating >= star) ? 'scale(1.15)' : 'scale(1)',
                      opacity: submitting ? 0.5 : 1,
                    }}
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <StarIcon
                      filled={hoveredStar ? hoveredStar >= star : selectedRating >= star}
                      size={48}
                    />
                  </button>
                ))}
              </div>

              {submitting && (
                <p style={{ fontSize: 14, color: '#015035', fontWeight: 500 }}>
                  Saving your rating...
                </p>
              )}

              {error && (
                <p style={{ fontSize: 14, color: '#ef4444', fontWeight: 500 }}>
                  {error}
                </p>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                padding: '0 8px',
              }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Not good</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>Excellent</span>
              </div>
            </div>
          )}

          {/* STEP: Feedback (1-3 stars) */}
          {step === 'feedback' && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 8px',
              }}>
                We appreciate your honesty
              </h2>
              <p style={{
                fontSize: 15,
                color: '#6b7280',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}>
                We&#39;re sorry your experience wasn&#39;t perfect. Could you share what we could improve?
              </p>

              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what happened..."
                rows={5}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: 12,
                  fontSize: 15,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#015035' }}
                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb' }}
              />

              {error && (
                <p style={{ fontSize: 14, color: '#ef4444', fontWeight: 500, marginTop: 12 }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleFeedbackSubmit}
                disabled={submitting || !feedback.trim()}
                style={{
                  width: '100%',
                  marginTop: 20,
                  padding: '14px 24px',
                  background: '#015035',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: submitting || !feedback.trim() ? 'not-allowed' : 'pointer',
                  opacity: submitting || !feedback.trim() ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <button
                onClick={() => setStep('done')}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 12,
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Skip
              </button>
            </div>
          )}

          {/* STEP: Redirect (4-5 stars, going to Google) */}
          {step === 'redirect' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 24 }}>
                <CheckIcon />
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 8px',
              }}>
                Thank you!
              </h2>
              <p style={{
                fontSize: 15,
                color: '#6b7280',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}>
                We&#39;re glad you had a great experience!<br />
                Redirecting you to leave a Google review...
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  border: '3px solid #e5e7eb',
                  borderTopColor: '#015035',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* STEP: Done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                <CheckIcon />
              </div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#1a1a1a',
                margin: '0 0 8px',
              }}>
                Thank you for your feedback!
              </h2>
              <p style={{
                fontSize: 15,
                color: '#6b7280',
                margin: 0,
                lineHeight: 1.6,
              }}>
                {alreadyCompleted
                  ? 'You have already submitted your response. We appreciate your time!'
                  : 'Your response has been recorded. We truly appreciate you taking the time to share your thoughts.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #f3f4f6',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 12,
            color: '#d1d5db',
            margin: 0,
          }}>
            Powered by {companyName}
          </p>
        </div>
      </div>
    </div>
  )
}
