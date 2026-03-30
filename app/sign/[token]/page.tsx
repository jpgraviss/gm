'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface SignatureData {
  id: string
  contractId: string
  token: string
  signerEmail: string
  signerName?: string
  type: 'client' | 'internal'
  status: 'pending' | 'signed' | 'expired'
  signedAt?: string
  createdAt: string
  expiresAt: string
  contract: {
    company: string
    value: number
    serviceType: string
  } | null
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sigReq, setSigReq] = useState<SignatureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signerName, setSignerName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [signatureDate, setSignatureDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const isDrawing = useRef(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/signatures/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSigReq(data)
          if (data.signerName) setSignerName(data.signerName)
          if (data.contract?.company) setCompanyName(data.contract.company)
          setSignatureDate(new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }))
        }
      })
      .catch(() => setError('Failed to load signature request'))
      .finally(() => setLoading(false))
  }, [token])

  // Canvas drawing
  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasDrawn(true)
  }, [getPos])

  const stopDraw = useCallback(() => {
    isDrawing.current = false
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSubmit() {
    const canvas = canvasRef.current
    if (!canvas || !sigReq) return
    if (!signerName.trim()) return
    if (!hasDrawn) return

    setSubmitting(true)
    try {
      const signatureData = canvas.toDataURL('image/png')
      const res = await fetch(`/api/signatures/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signatureData,
          companyName: companyName.trim() || undefined,
          signatureDate: signatureDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit signature')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Failed to submit signature. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formattedValue = sigReq?.contract?.value
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(sigReq.contract.value)
    : null

  const isExpired = sigReq?.expiresAt ? new Date(sigReq.expiresAt) < new Date() : false
  const isSigned = sigReq?.status === 'signed'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (error && !sigReq) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#ef4444" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Syncopate', sans-serif" }}>Link Not Found</h2>
          <p className="text-sm text-gray-500">This signature link is invalid or has been removed.</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#01503515' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="#015035" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Syncopate', sans-serif" }}>Signed!</h2>
          <p className="text-sm text-gray-500 mb-1">Your signature has been recorded successfully.</p>
          {sigReq?.contract && (
            <p className="text-xs text-gray-400">
              {sigReq.contract.company} &middot; {formattedValue}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (isSigned) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Syncopate', sans-serif" }}>Already Signed</h2>
          <p className="text-sm text-gray-500">This document has already been signed{sigReq?.signedAt ? ` on ${new Date(sigReq.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.</p>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="#d97706" strokeWidth="2" strokeLinecap="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Syncopate', sans-serif" }}>Link Expired</h2>
          <p className="text-sm text-gray-500">This signature link has expired. Please contact Graviss Marketing for a new link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: '#015035' }} className="px-4 py-6 text-center">
        <h1 className="text-white text-lg font-bold tracking-wider" style={{ fontFamily: "'Syncopate', sans-serif" }}>
          GRAVISS MARKETING
        </h1>
        <p className="text-white/60 text-xs tracking-wide mt-1" style={{ fontFamily: "'Syncopate', sans-serif" }}>
          E-SIGNATURE
        </p>
      </div>

      <div className="max-w-lg mx-auto p-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Contract details */}
          {sigReq?.contract && (
            <div className="p-5 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Contract Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Company</p>
                  <p className="text-sm font-semibold text-gray-900">{sigReq.contract.company}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Service</p>
                  <p className="text-sm font-semibold text-gray-900">{sigReq.contract.serviceType}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Contract Value</p>
                  <p className="text-sm font-bold" style={{ color: '#015035' }}>{formattedValue}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Signer</p>
                  <p className="text-sm text-gray-700">{sigReq.signerEmail}</p>
                </div>
              </div>
            </div>
          )}

          {/* Signer fields */}
          {sigReq?.type === 'internal' ? (
            /* Internal signer: simpler form with pre-filled name and date */
            <div className="p-5 border-b border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    readOnly
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Date
                  </label>
                  <input
                    type="text"
                    value={signatureDate}
                    readOnly
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Client signer: company name, full name, and date */
            <div className="p-5 border-b border-gray-100 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Enter company name"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                  Date
                </label>
                <input
                  type="text"
                  value={signatureDate}
                  readOnly
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700"
                />
              </div>
            </div>
          )}

          {/* Signature canvas */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Signature
              </label>
              <button
                onClick={clearCanvas}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                className="w-full cursor-crosshair touch-none"
                style={{ height: '160px' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
            {!hasDrawn && (
              <p className="text-[11px] text-gray-400 mt-2 text-center">Draw your signature above</p>
            )}
          </div>

          {/* Terms + submit */}
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              By signing below, I agree to the terms of this contract.
            </p>
            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 text-xs text-red-600 font-medium">
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || !signerName.trim() || !hasDrawn}
              className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#015035' }}
            >
              {submitting ? 'Submitting...' : 'Sign & Accept'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 mt-6">
          Powered by Graviss Marketing &middot; Secure E-Signature
        </p>
      </div>
    </div>
  )
}
