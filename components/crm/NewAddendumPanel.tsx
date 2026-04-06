'use client'

import { useState, useMemo } from 'react'
import { X, ChevronLeft, Search, FileText, DollarSign, Calendar } from 'lucide-react'
import type { Contract } from '@/lib/types'

const CHANGE_TYPES = ['Scope Change', 'Value Change', 'Term Extension', 'Termination', 'Other'] as const
type ChangeType = typeof CHANGE_TYPES[number]

export interface NewAddendumFormData {
  contractId: string
  title: string
  description: string
  changeType: ChangeType
  valueDelta?: number
  termDeltaMonths?: number
  scopeAdded?: string
  scopeRemoved?: string
  effectiveDate?: string
}

interface Props {
  contracts: Contract[]
  onSave: (data: NewAddendumFormData) => void
  onClose: () => void
  initialContractId?: string
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>
}

export default function NewAddendumPanel({ contracts, onSave, onClose, initialContractId }: Props) {
  const initialContract = initialContractId ? contracts.find(c => c.id === initialContractId) ?? null : null

  const [selected, setSelected] = useState<Contract | null>(initialContract)
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [changeType, setChangeType] = useState<ChangeType>('Scope Change')
  const [valueDelta, setValueDelta] = useState('')
  const [termDeltaMonths, setTermDeltaMonths] = useState('')
  const [scopeAdded, setScopeAdded] = useState('')
  const [scopeRemoved, setScopeRemoved] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  // Skip fully expired / terminated contracts
  const eligibleContracts = useMemo(
    () => contracts.filter(c => c.status !== 'Expired'),
    [contracts]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return eligibleContracts.slice(0, 30)
    return eligibleContracts.filter(c =>
      c.company.toLowerCase().includes(q) ||
      c.serviceType.toLowerCase().includes(q) ||
      c.assignedRep.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    ).slice(0, 30)
  }, [eligibleContracts, search])

  const canSave = Boolean(selected && title.trim() && description.trim())

  function handleSave() {
    if (!canSave || !selected) return
    onSave({
      contractId: selected.id,
      title: title.trim(),
      description: description.trim(),
      changeType,
      valueDelta: valueDelta.trim() ? Number(valueDelta) : undefined,
      termDeltaMonths: termDeltaMonths.trim() ? Number(termDeltaMonths) : undefined,
      scopeAdded: scopeAdded.trim() || undefined,
      scopeRemoved: scopeRemoved.trim() || undefined,
      effectiveDate: effectiveDate || undefined,
    })
  }

  // Contextual fields toggle based on change type
  const showValue = changeType === 'Value Change' || changeType === 'Scope Change' || changeType === 'Other'
  const showTerm  = changeType === 'Term Extension' || changeType === 'Other'
  const showScope = changeType === 'Scope Change' || changeType === 'Other'

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200 w-full lg:w-[560px]">

        {/* Header */}
        <div className="p-6 flex-shrink-0 flex items-start justify-between" style={{ background: '#012b1e' }}>
          <button onClick={onClose} className="sm:hidden flex items-center gap-1 text-white/70 hover:text-white text-xs font-medium mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div>
            <h2 className="text-white font-bold text-base">New Addendum</h2>
            <p className="text-white/50 text-xs mt-0.5">
              {selected ? `To ${selected.company} · ${selected.serviceType}` : 'Find a contract, then capture the changes'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Contract search */}
          {selected ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Contract</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.company} · {selected.serviceType}</p>
                <p className="text-[11px] text-gray-500">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(selected.value)}
                  {' · '}{selected.status}
                  {' · '}{selected.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <FieldLabel>Find contract</FieldLabel>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by company, service, rep, or ID…"
                  className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white placeholder-gray-400"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {search ? 'No matching contracts' : 'No contracts available'}
                  </p>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.company}</p>
                        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(c.value)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {c.serviceType} · {c.status} · {c.assignedRep || 'Unassigned'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Addendum form — only when a contract is selected */}
          {selected && (
            <>
              <div>
                <FieldLabel>Title</FieldLabel>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Add landing-page package"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                />
              </div>

              <div>
                <FieldLabel>Change type</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {CHANGE_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setChangeType(t)}
                      className={`text-xs font-semibold py-2 px-2.5 rounded-lg border transition-colors ${
                        changeType === t
                          ? 'text-white border-transparent'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      style={changeType === t ? { background: '#015035' } : {}}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {(showValue || showTerm) && (
                <div className="grid grid-cols-2 gap-3">
                  {showValue && (
                    <div>
                      <FieldLabel><span className="flex items-center gap-1"><DollarSign size={11} />Value delta</span></FieldLabel>
                      <input
                        type="number"
                        step="0.01"
                        value={valueDelta}
                        onChange={e => setValueDelta(e.target.value)}
                        placeholder="e.g. 2500 or -500"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                      />
                    </div>
                  )}
                  {showTerm && (
                    <div>
                      <FieldLabel>Term delta (months)</FieldLabel>
                      <input
                        type="number"
                        value={termDeltaMonths}
                        onChange={e => setTermDeltaMonths(e.target.value)}
                        placeholder="e.g. 6 or -3"
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {showScope && (
                <>
                  <div>
                    <FieldLabel>Scope added</FieldLabel>
                    <textarea
                      rows={2}
                      value={scopeAdded}
                      onChange={e => setScopeAdded(e.target.value)}
                      placeholder="One per line: deliverable, page, feature…"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
                    />
                  </div>
                  <div>
                    <FieldLabel>Scope removed</FieldLabel>
                    <textarea
                      rows={2}
                      value={scopeRemoved}
                      onChange={e => setScopeRemoved(e.target.value)}
                      placeholder="One per line: deliverable, page, feature…"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
                    />
                  </div>
                </>
              )}

              <div>
                <FieldLabel><span className="flex items-center gap-1"><Calendar size={11} />Effective date</span></FieldLabel>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <FieldLabel>Description / notes</FieldLabel>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the changes in plain language for the client…"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Save as Draft
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
