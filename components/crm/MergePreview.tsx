'use client'

import { useState, useMemo } from 'react'
import { X, ArrowRight, CheckCircle2 } from 'lucide-react'

interface MergePreviewProps {
  type: 'contacts' | 'companies'
  records: Record<string, unknown>[]
  primaryId: string
  onConfirm: (primaryId: string, mergeIds: string[], fieldOverrides: Record<string, unknown>) => void
  onCancel: () => void
}

const CONTACT_FIELDS = [
  { key: 'fullName', label: 'Name' },
  { key: 'title', label: 'Title' },
  { key: 'companyName', label: 'Company' },
  { key: 'owner', label: 'Owner' },
  { key: 'linkedIn', label: 'LinkedIn' },
  { key: 'website', label: 'Website' },
] as const

const COMPANY_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'hq', label: 'HQ' },
  { key: 'size', label: 'Size' },
  { key: 'owner', label: 'Owner' },
  { key: 'description', label: 'Description' },
] as const

export default function MergePreview({ type, records, primaryId, onConfirm, onCancel }: MergePreviewProps) {
  const fields = type === 'contacts' ? CONTACT_FIELDS : COMPANY_FIELDS
  const primary = records.find(r => r.id === primaryId)!
  const others = records.filter(r => r.id !== primaryId)

  const [overrides, setOverrides] = useState<Record<string, unknown>>({})

  const diffFields = useMemo(() => {
    return fields.filter(f => {
      const vals = records.map(r => String(r[f.key] ?? '').trim()).filter(Boolean)
      const unique = new Set(vals)
      return unique.size > 1
    })
  }, [fields, records])

  function getSelected(key: string): string {
    if (key in overrides) return String(overrides[key] ?? '')
    return String(primary[key] ?? '')
  }

  function handleConfirm() {
    const mergeIds = others.map(r => r.id as string)
    onConfirm(primaryId, mergeIds, overrides)
  }

  const mergedEmails = type === 'contacts'
    ? [...new Set(records.flatMap(r => (r.emails as string[]) ?? []))]
    : []
  const mergedPhones = type === 'contacts'
    ? [...new Set(records.flatMap(r => (r.phones as string[]) ?? []))]
    : []

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-900">Merge Preview</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {others.length} record{others.length > 1 ? 's' : ''} will be merged into the primary
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 flex-1">
              <CheckCircle2 size={14} style={{ color: '#015035' }} />
              <span className="text-sm font-semibold text-gray-900">
                {type === 'contacts' ? String(primary.fullName) : String(primary.name)}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ background: '#015035' }}>Primary</span>
            </div>
            <ArrowRight size={14} className="text-gray-300" />
            <div className="flex items-center gap-1.5">
              {others.map(o => (
                <span key={String(o.id)} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {type === 'contacts' ? String(o.fullName) : String(o.name)}
                </span>
              ))}
            </div>
          </div>

          {diffFields.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Field Differences</p>
              <div className="flex flex-col gap-2">
                {diffFields.map(f => (
                  <div key={f.key} className="border border-gray-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{f.label}</p>
                    <div className="flex flex-col gap-1.5">
                      {records.map(r => {
                        const val = String(r[f.key] ?? '')
                        if (!val) return null
                        const isSelected = getSelected(f.key) === val
                        const isPrimary = r.id === primaryId
                        return (
                          <label
                            key={String(r.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 border border-emerald-200'
                                : 'bg-gray-50 border border-transparent hover:border-gray-200'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`field-${f.key}`}
                              checked={isSelected}
                              onChange={() => {
                                if (isPrimary) {
                                  setOverrides(prev => {
                                    const next = { ...prev }
                                    delete next[f.key]
                                    return next
                                  })
                                } else {
                                  setOverrides(prev => ({ ...prev, [f.key]: val }))
                                }
                              }}
                              className="accent-emerald-600"
                            />
                            <span className={`text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                              {val}
                            </span>
                            {isPrimary && (
                              <span className="text-[9px] font-medium text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded ml-auto">
                                Primary
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diffFields.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">All fields match — no conflicts to resolve.</p>
          )}

          {type === 'contacts' && (mergedEmails.length > 0 || mergedPhones.length > 0) && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Combined Data</p>
              <div className="grid grid-cols-2 gap-3">
                {mergedEmails.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Emails ({mergedEmails.length})
                    </p>
                    {mergedEmails.map(e => (
                      <p key={e} className="text-xs text-gray-700 truncate">{e}</p>
                    ))}
                  </div>
                )}
                {mergedPhones.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                      Phones ({mergedPhones.length})
                    </p>
                    {mergedPhones.map(p => (
                      <p key={p} className="text-xs text-gray-700">{p}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90"
            style={{ background: '#015035' }}
          >
            Confirm Merge
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
