'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface ProposalLineItem {
  id: string
  description: string
  type: 'one-time' | 'recurring'
  quantity: number
  unitPrice: number
  total: number
}

interface ProposalData {
  id: string
  company: string
  value: number
  items: ProposalLineItem[]
  pdfUrl: string | null
  serviceType: string
  status: string
  notes: string | null
  clientNotes: string | null
  createdAt: string
  createdDate: string
  assignedRep: string
}

const COLORS = {
  forestGreen: '#015035',
  terracotta: '#CC7853',
  warmCream: '#FFF3EA',
  deepPine: '#012A1C',
  ink: '#1B211D',
  stone: '#8C8478',
}

function fmt(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)
}

function fmtDetailed(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

export default function ProposalViewPage() {
  const { token } = useParams<{ token: string }>()
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [responded, setResponded] = useState<'Accepted' | 'Declined' | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/proposals/view/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setProposal(data)
          if (data.status === 'Accepted' || data.status === 'Declined') {
            setResponded(data.status)
          }
        }
      })
      .catch(() => setError('Proposal not found or link has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleResponse(action: 'accept' | 'decline') {
    if (!token || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proposals/view/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, clientNotes: clientNotes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit response')
      } else {
        setResponded(action === 'accept' ? 'Accepted' : 'Declined')
      }
    } catch {
      setError('Failed to submit response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const oneTimeItems = proposal?.items.filter(i => i.type === 'one-time') ?? []
  const recurringItems = proposal?.items.filter(i => i.type === 'recurring') ?? []
  const oneTimeTotal = oneTimeItems.reduce((sum, i) => sum + (i.total ?? i.unitPrice * i.quantity), 0)
  const recurringTotal = recurringItems.reduce((sum, i) => sum + (i.total ?? i.unitPrice * i.quantity), 0)

  const proposalDate = proposal?.createdDate
    ? new Date(proposal.createdDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.forestGreen}20`, borderTopColor: COLORS.forestGreen, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Error / not found state ──
  if (error && !proposal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: '48px 40px', textAlign: 'center', maxWidth: 440, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#ef4444" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: COLORS.ink, fontFamily: "'Syncopate', sans-serif", letterSpacing: '0.04em' }}>
            Link Not Found
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: COLORS.stone, lineHeight: 1.6 }}>
            This proposal link is invalid, expired, or has been removed. Please contact Graviss Marketing for assistance.
          </p>
        </div>
      </div>
    )
  }

  // ── Already responded state ──
  if (responded) {
    const isAccepted = responded === 'Accepted'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: '48px 40px', textAlign: 'center', maxWidth: 440, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: isAccepted ? `${COLORS.forestGreen}10` : '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            {isAccepted ? (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke={COLORS.forestGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" d="M18 6L6 18M6 6l12 12" /></svg>
            )}
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: COLORS.ink, fontFamily: "'Syncopate', sans-serif", letterSpacing: '0.04em' }}>
            Proposal {responded}
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: COLORS.stone, lineHeight: 1.6 }}>
            {isAccepted
              ? 'Thank you for accepting this proposal! Our team will be in touch shortly to get started.'
              : 'This proposal has been declined. If you have any questions or would like to discuss alternatives, please reach out.'}
          </p>
          {proposal && (
            <p style={{ margin: 0, fontSize: 13, color: COLORS.stone }}>
              {proposal.company} &middot; {proposal.serviceType} &middot; {fmt(proposal.value)}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!proposal) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Montserrat:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: COLORS.deepPine, padding: '40px 24px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.03)' }} />
        <h1 style={{
          color: '#ffffff', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em',
          fontFamily: "'Syncopate', sans-serif", margin: '0 0 6px', position: 'relative',
        }}>
          GRAVISS MARKETING
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.15em',
          fontFamily: "'Syncopate', sans-serif", position: 'relative',
        }}>
          PROPOSAL
        </p>
      </header>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px 60px', marginTop: -20, position: 'relative' }}>

        {/* ── Company & Meta Card ── */}
        <section style={{
          background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '32px 36px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Prepared For
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px', fontFamily: "'Montserrat', sans-serif" }}>
                {proposal.company}
              </h2>
              <p style={{ fontSize: 13, color: COLORS.stone }}>{proposalDate}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
                Service
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.forestGreen }}>{proposal.serviceType}</p>
            </div>
          </div>
        </section>

        {/* ── Full Proposal PDF ── */}
        {proposal.pdfUrl && (
          <section style={{
            background: COLORS.forestGreen, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: '28px 36px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
          }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                Your Full Proposal
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>
                Scope, timeline, terms, and investment details
              </p>
            </div>
            <a
              href={proposal.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '12px 24px', borderRadius: 10, background: '#ffffff', color: COLORS.forestGreen,
                fontSize: 14, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              View PDF
            </a>
          </section>
        )}

        {/* ── Executive Summary ── */}
        <section style={{
          background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '32px 36px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 3, height: 22, background: COLORS.forestGreen, borderRadius: 2 }} />
            <h3 style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Executive Summary
            </h3>
          </div>
          <p style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.7 }}>
            Thank you for considering Graviss Marketing as your partner. We are excited to present this
            {' '}{proposal.serviceType.toLowerCase()} proposal tailored to meet your business objectives.
            Our team is committed to delivering measurable results and building a lasting partnership
            with {proposal.company}.
          </p>
        </section>

        {/* ── Pricing Section ── */}
        {proposal.items.length > 0 && (
          <section style={{
            background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            padding: '32px 36px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 3, height: 22, background: COLORS.forestGreen, borderRadius: 2 }} />
              <h3 style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Investment Details
              </h3>
            </div>

            {/* Recurring Items */}
            {recurringItems.length > 0 && (
              <div style={{ marginBottom: oneTimeItems.length > 0 ? 28 : 0 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  Recurring Services
                </p>
                <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid #e8e4df` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: COLORS.warmCream }}>
                        <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Service</th>
                        <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 60 }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 100 }}>Rate</th>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 110 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringItems.map((item, i) => (
                        <tr key={item.id || i} style={{ borderTop: '1px solid #f0ece7' }}>
                          <td style={{ padding: '12px 16px', color: COLORS.ink, fontWeight: 500 }}>{item.description}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.stone, textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.stone, textAlign: 'right' }}>{fmtDetailed(item.unitPrice)}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.ink, fontWeight: 600, textAlign: 'right' }}>{fmtDetailed(item.total ?? item.unitPrice * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${COLORS.forestGreen}20` }}>
                        <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: COLORS.ink, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Monthly Recurring
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 700, color: COLORS.forestGreen, textAlign: 'right' }}>
                          {fmtDetailed(recurringTotal)}<span style={{ fontSize: 11, fontWeight: 500, color: COLORS.stone }}>/mo</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* One-Time Items */}
            {oneTimeItems.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  One-Time Services
                </p>
                <div style={{ overflow: 'hidden', borderRadius: 10, border: `1px solid #e8e4df` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: COLORS.warmCream }}>
                        <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Service</th>
                        <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 60 }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 100 }}>Rate</th>
                        <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', width: 110 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oneTimeItems.map((item, i) => (
                        <tr key={item.id || i} style={{ borderTop: '1px solid #f0ece7' }}>
                          <td style={{ padding: '12px 16px', color: COLORS.ink, fontWeight: 500 }}>{item.description}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.stone, textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.stone, textAlign: 'right' }}>{fmtDetailed(item.unitPrice)}</td>
                          <td style={{ padding: '12px 16px', color: COLORS.ink, fontWeight: 600, textAlign: 'right' }}>{fmtDetailed(item.total ?? item.unitPrice * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${COLORS.forestGreen}20` }}>
                        <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: COLORS.ink, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          One-Time Total
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 700, color: COLORS.forestGreen, textAlign: 'right' }}>
                          {fmtDetailed(oneTimeTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Total Value Card ── */}
        <section style={{
          background: COLORS.deepPine, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          padding: '28px 36px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
              Total Investment
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', fontFamily: "'Montserrat', sans-serif" }}>
              {fmt(proposal.value)}
            </p>
          </div>
          {recurringTotal > 0 && oneTimeTotal > 0 && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                {fmt(recurringTotal)}/mo recurring
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                {fmt(oneTimeTotal)} one-time
              </p>
            </div>
          )}
        </section>

        {/* ── Response Section ── */}
        <section style={{
          background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '32px 36px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 3, height: 22, background: COLORS.terracotta, borderRadius: 2 }} />
            <h3 style={{ fontSize: 11, fontWeight: 700, color: COLORS.ink, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Your Response
            </h3>
          </div>

          <p style={{ fontSize: 14, color: COLORS.stone, lineHeight: 1.6, marginBottom: 20 }}>
            Please review the proposal details above and let us know your decision. You may include any notes or questions below.
          </p>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.stone, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Notes (optional)
            </label>
            <textarea
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Any questions, comments, or requested changes..."
              rows={4}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 14, color: COLORS.ink,
                border: '1px solid #e8e4df', borderRadius: 10, resize: 'vertical',
                fontFamily: "'Montserrat', sans-serif", lineHeight: 1.6,
                outline: 'none', background: COLORS.warmCream,
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = COLORS.forestGreen }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e4df' }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '12px 16px', borderRadius: 10,
              background: '#fef2f2', fontSize: 13, color: '#dc2626', fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => handleResponse('accept')}
              disabled={submitting}
              style={{
                flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none',
                background: COLORS.forestGreen, color: '#ffffff',
                fontSize: 14, fontWeight: 700, fontFamily: "'Montserrat', sans-serif",
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                transition: 'opacity 0.2s, transform 0.1s',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.opacity = '1' }}
            >
              {submitting ? 'Submitting...' : 'Accept Proposal'}
            </button>
            <button
              onClick={() => handleResponse('decline')}
              disabled={submitting}
              style={{
                flex: 1, padding: '14px 24px', borderRadius: 10,
                border: `1.5px solid #e8e4df`, background: '#ffffff', color: COLORS.stone,
                fontSize: 14, fontWeight: 600, fontFamily: "'Montserrat', sans-serif",
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.borderColor = '#dc2626' }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.borderColor = '#e8e4df' }}
            >
              Decline
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ textAlign: 'center', padding: '32px 0 16px' }}>
          <p style={{ fontSize: 11, color: COLORS.stone, letterSpacing: '0.04em' }}>
            Powered by <span style={{ fontWeight: 600, color: COLORS.forestGreen }}>Graviss Marketing</span>
          </p>
          <p style={{ fontSize: 10, color: COLORS.stone, marginTop: 6 }}>
            <a href="https://www.gravissmarketing.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.stone, textDecoration: 'underline' }}>Privacy Policy</a>
            {' · '}
            <a href="https://www.gravissmarketing.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.stone, textDecoration: 'underline' }}>Terms of Service</a>
          </p>
        </footer>
      </main>
    </div>
  )
}
