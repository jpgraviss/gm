'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import StatusBadge from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, proposalStatusColors, contractStatusColors } from '@/lib/utils'
import {
  ArrowLeft, FileText, CheckCircle, XCircle, MessageSquare,
  ChevronRight, X, PenTool,
} from 'lucide-react'

interface Proposal {
  id: string
  company: string
  status: string
  value: number
  serviceType: string
  items: Array<{ name: string; description?: string; price: number }>
  sentDate?: string
  createdDate: string
}

interface Contract {
  id: string
  company: string
  status: string
  value: number
  serviceType: string
  billingStructure: string
  startDate: string
  duration: number
  renewalDate: string
  clientSigned?: string
}

type ApprovalItem = {
  type: 'proposal'
  data: Proposal
} | {
  type: 'contract'
  data: Contract
}

function SignatureCanvas({ onSave, onCancel }: { onSave: (sig: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [getPos])

  const stopDraw = useCallback(() => { drawing.current = false }, [])

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !canvasRef.current) return
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  function save() {
    if (!canvasRef.current) return
    onSave(canvasRef.current.toDataURL())
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-600">Draw your signature</p>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full border border-gray-200 rounded-xl bg-white cursor-crosshair touch-none"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div className="flex items-center gap-2">
        <button onClick={clearCanvas} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">
          Clear
        </button>
        <div className="flex-1" />
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200">
          Cancel
        </button>
        <button onClick={save} className="text-xs text-white font-semibold px-4 py-1.5 rounded-lg" style={{ background: '#015035' }}>
          Apply Signature
        </button>
      </div>
    </div>
  )
}

export default function PortalApprovalsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const company = user?.company ?? ''
  const contactName = user?.name ?? ''

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null)
  const [actionMode, setActionMode] = useState<'accept' | 'decline' | 'changes' | null>(null)
  const [sigMode, setSigMode] = useState<'type' | 'draw'>('type')
  const [typedSig, setTypedSig] = useState('')
  const [drawnSig, setDrawnSig] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!company) { setLoading(false); return }
    const q = encodeURIComponent(company)
    Promise.all([
      fetch(`/api/proposals?company=${q}`).then(r => r.ok ? r.json() : []).then((d: Proposal[]) => setProposals(Array.isArray(d) ? d : [])),
      fetch(`/api/contracts?company=${q}`).then(r => r.ok ? r.json() : []).then((d: Contract[]) => setContracts(Array.isArray(d) ? d : [])),
    ])
      .catch(() => toast('Failed to load approvals', 'error'))
      .finally(() => setLoading(false))
  }, [company])

  const pendingProposals = proposals.filter(p => ['Sent', 'Viewed'].includes(p.status))
  const pendingContracts = contracts.filter(c => ['Sent', 'Viewed'].includes(c.status))
  const completedProposals = proposals.filter(p => ['Accepted', 'Declined'].includes(p.status))
  const completedContracts = contracts.filter(c => ['Signed by Client', 'Fully Executed'].includes(c.status))

  function resetActionState() {
    setActionMode(null)
    setSigMode('type')
    setTypedSig('')
    setDrawnSig(null)
    setFeedback('')
  }

  async function handleAccept() {
    if (!selectedItem) return
    const hasSignature = sigMode === 'type' ? typedSig.trim().length > 0 : !!drawnSig
    if (!hasSignature) { toast('Please provide a signature', 'error'); return }

    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]
    try {
      if (selectedItem.type === 'proposal') {
        const res = await fetch(`/api/proposals/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Accepted', respondedDate: today }),
        })
        if (!res.ok) throw new Error()
        setProposals(prev => prev.map(p => p.id === selectedItem.data.id ? { ...p, status: 'Accepted' } : p))
      } else {
        const res = await fetch(`/api/contracts/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Signed by Client', clientSigned: today }),
        })
        if (!res.ok) throw new Error()
        setContracts(prev => prev.map(c => c.id === selectedItem.data.id ? { ...c, status: 'Signed by Client', clientSigned: today } : c))
      }
      toast('Accepted successfully', 'success')
      resetActionState()
      setSelectedItem(null)
    } catch {
      toast('Failed to accept. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDecline() {
    if (!selectedItem) return
    setSubmitting(true)
    const today = new Date().toISOString().split('T')[0]
    try {
      if (selectedItem.type === 'proposal') {
        const res = await fetch(`/api/proposals/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Declined', respondedDate: today }),
        })
        if (!res.ok) throw new Error()
        setProposals(prev => prev.map(p => p.id === selectedItem.data.id ? { ...p, status: 'Declined' } : p))
      } else {
        const res = await fetch(`/api/contracts/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Expired' }),
        })
        if (!res.ok) throw new Error()
        setContracts(prev => prev.map(c => c.id === selectedItem.data.id ? { ...c, status: 'Expired' } : c))
      }
      toast('Declined successfully', 'success')
      resetActionState()
      setSelectedItem(null)
    } catch {
      toast('Failed to decline. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestChanges() {
    if (!selectedItem || !feedback.trim()) { toast('Please provide feedback', 'error'); return }
    setSubmitting(true)
    try {
      if (selectedItem.type === 'proposal') {
        const res = await fetch(`/api/proposals/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Draft', renewalNotes: `Client feedback: ${feedback.trim()}` }),
        })
        if (!res.ok) throw new Error()
        setProposals(prev => prev.map(p => p.id === selectedItem.data.id ? { ...p, status: 'Draft' } : p))
      } else {
        const res = await fetch(`/api/contracts/${selectedItem.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Draft' }),
        })
        if (!res.ok) throw new Error()
        setContracts(prev => prev.map(c => c.id === selectedItem.data.id ? { ...c, status: 'Draft' } : c))
      }
      toast('Changes requested', 'success')
      resetActionState()
      setSelectedItem(null)
    } catch {
      toast('Failed to submit feedback. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#015035' }} />
      </div>
    )
  }

  if (selectedItem) {
    const d = selectedItem.data
    const isPending = selectedItem.type === 'proposal'
      ? ['Sent', 'Viewed'].includes(d.status)
      : ['Sent', 'Viewed'].includes(d.status)

    return (
      <div className="min-h-screen" style={{ background: '#f8fafc' }}>
        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
          <button
            onClick={() => { setSelectedItem(null); resetActionState() }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Approvals
          </button>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {selectedItem.type === 'proposal' ? 'Proposal' : 'Contract'}: {d.serviceType}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{d.company} · {formatCurrency(d.value)}</p>
            </div>
            <StatusBadge
              label={d.status}
              colorClass={selectedItem.type === 'proposal'
                ? (proposalStatusColors[d.status] ?? 'bg-gray-100 text-gray-600')
                : (contractStatusColors[d.status] ?? 'bg-gray-100 text-gray-600')}
            />
          </div>
        </div>

        <div className="p-4 sm:p-8 max-w-3xl mx-auto flex flex-col gap-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Details</h3>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Type</span>
                <span className="font-semibold text-gray-800">{selectedItem.type === 'proposal' ? 'Proposal' : 'Contract'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Service</span>
                <span className="font-semibold text-gray-800">{d.serviceType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Value</span>
                <span className="font-bold text-gray-900">{formatCurrency(d.value)}</span>
              </div>
              {selectedItem.type === 'proposal' && (selectedItem.data as Proposal).sentDate && (
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Date Sent</span>
                  <span className="text-gray-700">{formatDate((selectedItem.data as Proposal).sentDate!)}</span>
                </div>
              )}
              {selectedItem.type === 'contract' && (
                <>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Billing</span>
                    <span className="text-gray-700">{(selectedItem.data as Contract).billingStructure}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">Duration</span>
                    <span className="text-gray-700">{(selectedItem.data as Contract).duration} months</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {selectedItem.type === 'proposal' && (selectedItem.data as Proposal).items.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Line Items</h3>
              <div className="flex flex-col gap-2">
                {(selectedItem.data as Proposal).items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{item.name}</p>
                      {item.description && <p className="text-[11px] text-gray-400">{item.description}</p>}
                    </div>
                    <p className="text-xs font-bold text-gray-900">{formatCurrency(item.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPending && !actionMode && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActionMode('accept')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold"
                style={{ background: '#015035' }}
              >
                <CheckCircle size={14} /> Accept
              </button>
              <button
                onClick={() => setActionMode('decline')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle size={14} /> Decline
              </button>
              <button
                onClick={() => setActionMode('changes')}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <MessageSquare size={14} /> Request Changes
              </button>
            </div>
          )}

          {actionMode === 'accept' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">E-Signature Required</h3>
              <p className="text-xs text-gray-400 mb-4">By signing, you agree to the terms of this {selectedItem.type}.</p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSigMode('type')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sigMode === 'type' ? 'text-white' : 'border border-gray-200 text-gray-600'}`}
                  style={sigMode === 'type' ? { background: '#015035' } : {}}
                >
                  Type Name
                </button>
                <button
                  onClick={() => setSigMode('draw')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${sigMode === 'draw' ? 'text-white' : 'border border-gray-200 text-gray-600'}`}
                  style={sigMode === 'draw' ? { background: '#015035' } : {}}
                >
                  <PenTool size={11} /> Draw
                </button>
              </div>

              {sigMode === 'type' ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={typedSig}
                    onChange={e => setTypedSig(e.target.value)}
                    placeholder={contactName || 'Full legal name'}
                    className="w-full text-lg border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-300"
                    style={{ fontFamily: "'Caveat', cursive", fontSize: '24px' }}
                  />
                  {typedSig.trim() && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                      <p className="text-2xl text-gray-800" style={{ fontFamily: "'Caveat', cursive" }}>{typedSig}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={resetActionState} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                      Cancel
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={!typedSig.trim() || submitting}
                      className="text-xs text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                      style={{ background: '#015035' }}
                    >
                      {submitting ? 'Submitting...' : 'Sign & Accept'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {drawnSig ? (
                    <div className="flex flex-col gap-3">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={drawnSig} alt="Signature" className="max-h-24 mx-auto" />
                        <p className="text-[11px] text-gray-400 mt-1">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setDrawnSig(null)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                          Redo
                        </button>
                        <button onClick={resetActionState} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                          Cancel
                        </button>
                        <button
                          onClick={handleAccept}
                          disabled={submitting}
                          className="text-xs text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                          style={{ background: '#015035' }}
                        >
                          {submitting ? 'Submitting...' : 'Sign & Accept'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SignatureCanvas
                      onSave={(data) => setDrawnSig(data)}
                      onCancel={resetActionState}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {actionMode === 'decline' && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Confirm Decline</h3>
              <p className="text-xs text-gray-500 mb-4">Are you sure you want to decline this {selectedItem.type}? This action cannot be undone.</p>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={resetActionState} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={submitting}
                  className="text-xs text-white font-semibold px-4 py-2 rounded-lg bg-red-600 disabled:opacity-40"
                >
                  {submitting ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          )}

          {actionMode === 'changes' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Request Changes</h3>
              <p className="text-xs text-gray-400 mb-3">Describe what you would like changed. The document will be revised and re-sent.</p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Describe the changes you need..."
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400 mb-3"
              />
              <div className="flex items-center gap-2 justify-end">
                <button onClick={resetActionState} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200">
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={!feedback.trim() || submitting}
                  className="text-xs text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
                  style={{ background: '#015035' }}
                >
                  {submitting ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const allPending: ApprovalItem[] = [
    ...pendingProposals.map(p => ({ type: 'proposal' as const, data: p })),
    ...pendingContracts.map(c => ({ type: 'contract' as const, data: c })),
  ]
  const allCompleted: ApprovalItem[] = [
    ...completedProposals.map(p => ({ type: 'proposal' as const, data: p })),
    ...completedContracts.map(c => ({ type: 'contract' as const, data: c })),
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-200 bg-white">
        <Link href="/portal" className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Proposals & Contracts</h1>
        <p className="text-xs text-gray-500 mt-0.5">Review and approve pending documents</p>
      </div>
      <div className="p-4 sm:p-8 max-w-4xl mx-auto flex flex-col gap-6">
        {allPending.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Awaiting Your Action</h2>
            <div className="flex flex-col gap-3">
              {allPending.map(item => (
                <button
                  key={item.data.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-[#015035]/30 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e6f0ec' }}>
                        <FileText size={16} style={{ color: '#015035' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-[#015035] transition-colors">
                          {item.type === 'proposal' ? 'Proposal' : 'Contract'}: {item.data.serviceType}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                          <span>{formatCurrency(item.data.value)}</span>
                          {item.type === 'proposal' && (item.data as Proposal).sentDate && (
                            <span>Sent {formatDate((item.data as Proposal).sentDate!)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={item.data.status}
                        colorClass={item.type === 'proposal'
                          ? (proposalStatusColors[item.data.status] ?? 'bg-gray-100 text-gray-600')
                          : (contractStatusColors[item.data.status] ?? 'bg-gray-100 text-gray-600')}
                      />
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#015035] transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {allPending.length === 0 && allCompleted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <FileText size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No proposals or contracts</p>
            <p className="text-xs text-gray-400 mt-1">Documents will appear here when they are sent to you.</p>
          </div>
        )}

        {allCompleted.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Completed</h2>
            <div className="flex flex-col gap-3">
              {allCompleted.map(item => (
                <button
                  key={item.data.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={14} className="text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {item.type === 'proposal' ? 'Proposal' : 'Contract'}: {item.data.serviceType}
                        </p>
                        <p className="text-[11px] text-gray-400">{formatCurrency(item.data.value)}</p>
                      </div>
                    </div>
                    <StatusBadge
                      label={item.data.status}
                      colorClass={item.type === 'proposal'
                        ? (proposalStatusColors[item.data.status] ?? 'bg-gray-100 text-gray-600')
                        : (contractStatusColors[item.data.status] ?? 'bg-gray-100 text-gray-600')}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
