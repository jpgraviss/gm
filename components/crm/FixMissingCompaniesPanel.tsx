'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Building2, CheckCircle2, HelpCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface MatchPreview {
  contactId: string
  contactName: string
  companyNameOnFile: string
  matchedCompanyId: string
  matchedCompanyName: string
}
interface UnmatchedContact {
  contactId: string
  contactName: string
  companyNameOnFile: string
  ambiguous?: boolean
}

interface FixMissingCompaniesPanelProps {
  onClose: () => void
  onFixed?: () => void
}

export default function FixMissingCompaniesPanel({ onClose, onFixed }: FixMissingCompaniesPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<MatchPreview[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([])
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    fetch('/api/crm/contacts/fix-company')
      .then(r => r.ok ? r.json() : { matches: [], unmatched: [] })
      .then(data => {
        setMatches(data.matches ?? [])
        setUnmatched(data.unmatched ?? [])
      })
      .catch(() => toast('Failed to scan contacts', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  async function handleApply() {
    setApplying(true)
    try {
      const res = await fetch('/api/crm/contacts/fix-company', { method: 'POST' })
      if (!res.ok) {
        toast('Failed to fix companies', 'error')
        setApplying(false)
        return
      }
      const data = await res.json()
      if (data.failures?.length > 0) {
        toast(`Fixed ${data.updated}, but ${data.failures.length} failed — try again`, 'error')
      } else {
        toast(`Linked ${data.updated} contact${data.updated === 1 ? '' : 's'} to their company`, 'success')
      }
      setApplied(true)
      onFixed?.()
    } catch {
      toast('Failed to fix companies', 'error')
    }
    setApplying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div
        className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200"
        style={{ width: 'min(560px, 100vw)' }}
      >
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#015035' }}>
                <Building2 size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                  Fix Missing Companies
                </h2>
                <p className="text-white/50 text-xs mt-0.5">
                  {loading ? 'Scanning...' : `${matches.length} match${matches.length === 1 ? '' : 'es'} found, ${unmatched.length} unmatched`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={24} className="animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Scanning contacts...</p>
            </div>
          )}

          {!loading && matches.length === 0 && unmatched.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <p className="text-sm text-gray-600 font-medium">Every contact is linked</p>
              <p className="text-xs text-gray-400">No contacts are missing a company connection.</p>
            </div>
          )}

          {!loading && matches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                {applied ? 'Linked' : 'Will be linked'} ({matches.length})
              </h3>
              <div className="flex flex-col gap-2">
                {matches.map(m => (
                  <div key={m.contactId} className="p-3 rounded-lg border border-gray-100 bg-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.contactName}</p>
                      <p className="text-[11px] text-gray-400 truncate">&ldquo;{m.companyNameOnFile}&rdquo;</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold flex-shrink-0" style={{ color: '#015035' }}>
                      {applied && <CheckCircle2 size={13} />}
                      <Building2 size={13} /> {m.matchedCompanyName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && unmatched.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <HelpCircle size={13} className="text-amber-500" /> Needs manual review ({unmatched.length})
              </h3>
              <p className="text-[11px] text-gray-400 mb-2">
                No company on file, or the name didn&apos;t match a real company — left alone to avoid guessing wrong. Assign these manually from the contact&apos;s edit panel.
              </p>
              <div className="flex flex-col gap-2">
                {unmatched.map(u => (
                  <div key={u.contactId} className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.contactName}</p>
                    <p className="text-[11px] text-gray-400 truncate flex-shrink-0">
                      {u.ambiguous
                        ? `"${u.companyNameOnFile}" (ambiguous — multiple companies share this name)`
                        : u.companyNameOnFile ? `"${u.companyNameOnFile}" (no match)` : 'No company on file'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            {applied ? 'Close' : 'Cancel'}
          </button>
          {!applied && matches.length > 0 && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: '#015035' }}
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
              {applying ? 'Fixing...' : `Fix ${matches.length} Contact${matches.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
