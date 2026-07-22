'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Mail, Phone, User, Building2, GitMerge, AlertTriangle, CheckCircle2, EyeOff } from 'lucide-react'
import MergePreview from './MergePreview'
import { useToast } from '@/components/ui/Toast'

interface DuplicateGroup {
  key: string
  records: Record<string, unknown>[]
  matchType: 'email' | 'name' | 'phone' | 'domain'
}

interface DuplicatesPanelProps {
  type: 'contacts' | 'companies'
  onClose: () => void
  onMergeComplete?: () => void
}

const matchTypeConfig: Record<string, { label: string; color: string; bg: string; confidence: string }> = {
  email:  { label: 'Email Match',  color: '#dc2626', bg: '#fef2f2', confidence: 'Likely duplicate' },
  name:   { label: 'Name Match',   color: '#f97316', bg: '#fff7ed', confidence: 'Possible duplicate' },
  phone:  { label: 'Phone Match',  color: '#dc2626', bg: '#fef2f2', confidence: 'Likely duplicate' },
  domain: { label: 'Domain Match', color: '#f97316', bg: '#fff7ed', confidence: 'Possible duplicate' },
}

function borderColor(matchType: string): string {
  return matchType === 'email' || matchType === 'phone' ? '#ef4444' : '#f97316'
}

export default function DuplicatesPanel({ type, onClose, onMergeComplete }: DuplicatesPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({})
  const [mergingGroup, setMergingGroup] = useState<DuplicateGroup | null>(null)
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    fetch(`/api/crm/duplicates?type=${type}`)
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(data => {
        const g = data.groups ?? []
        setGroups(g)
        const defaults: Record<string, string> = {}
        for (const group of g) {
          defaults[group.key] = String(group.records[0]?.id ?? '')
        }
        setSelectedPrimary(defaults)
      })
      .catch(() => toast('Failed to load duplicates', 'error'))
      .finally(() => setLoading(false))
  }, [type, toast])

  async function handleMerge(primaryId: string, mergeIds: string[], fieldOverrides: Record<string, unknown>) {
    setMerging(true)
    try {
      const res = await fetch('/api/crm/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, primaryId, mergeIds, fieldOverrides }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Merge failed' }))
        toast(err.error ?? 'Merge failed', 'error')
        setMerging(false)
        setMergingGroup(null)
        return
      }
      setGroups(prev => prev.filter(g => g !== mergingGroup))
      setMergingGroup(null)
      toast('Records merged successfully', 'success')
      onMergeComplete?.()
    } catch {
      toast('Merge failed', 'error')
    }
    setMerging(false)
  }

  async function handleIgnore(group: DuplicateGroup) {
    // Instantly remove from local state
    setGroups(prev => prev.filter(g => g.key !== group.key))
    // Persist to server
    try {
      const res = await fetch('/api/crm/duplicates/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, groupKey: group.key }),
      })
      // AUDIT #279 — this showed "dismissed" and removed the group from
      // local state before checking res.ok; a server error meant the
      // dismissal never actually persisted, and the group silently
      // reappeared on the next duplicates scan with no indication the
      // earlier "success" toast had been wrong.
      if (!res.ok) throw new Error('Failed')
      toast('Duplicate group dismissed', 'success')
    } catch {
      setGroups(prev => [...prev, group])
      toast('Failed to save dismissal', 'error')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex pointer-events-none">
        <div className="flex-1 pointer-events-auto" onClick={onClose} />
        <div
          className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200"
          style={{ width: 'min(580px, 100vw)' }}
        >
          <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#015035' }}>
                  <GitMerge size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}>
                    Duplicate {type === 'contacts' ? 'Contacts' : 'Companies'}
                  </h2>
                  <p className="text-white/50 text-xs mt-0.5">
                    {loading ? 'Scanning...' : `${groups.length} group${groups.length !== 1 ? 's' : ''} found`}
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
                <p className="text-sm text-gray-400">Scanning for duplicates...</p>
              </div>
            )}

            {!loading && groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 size={32} className="text-emerald-400" />
                <p className="text-sm text-gray-600 font-medium">No duplicates found</p>
                <p className="text-xs text-gray-400">Your {type} data looks clean.</p>
              </div>
            )}

            {!loading && groups.length > 0 && (
              <div className="flex flex-col gap-4">
                {groups.map(group => {
                  const cfg = matchTypeConfig[group.matchType] ?? matchTypeConfig.name
                  return (
                    <div
                      key={group.key}
                      className="rounded-xl border border-gray-200 overflow-hidden"
                      style={{ borderLeftWidth: 4, borderLeftColor: borderColor(group.matchType) }}
                    >
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: cfg.color, background: cfg.bg }}
                          >
                            {cfg.label}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <AlertTriangle size={11} />
                            {cfg.confidence}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {group.records.length} records
                        </span>
                      </div>

                      <div className="px-4 py-3 flex flex-col gap-2">
                        {group.records.map(rec => {
                          const id = String(rec.id)
                          const isSelected = selectedPrimary[group.key] === id
                          return (
                            <label
                              key={id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? 'border-emerald-200 bg-emerald-50/50'
                                  : 'border-gray-100 hover:border-gray-200 bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`primary-${group.key}`}
                                checked={isSelected}
                                onChange={() => setSelectedPrimary(prev => ({ ...prev, [group.key]: id }))}
                                className="accent-emerald-600 flex-shrink-0"
                              />
                              {type === 'contacts' ? (
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: '#015035' }}
                                  >
                                    {String(rec.firstName ?? '')[0]}{String(rec.lastName ?? '')[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{String(rec.fullName)}</p>
                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                                      {(rec.emails as string[])?.[0] && (
                                        <span className="flex items-center gap-0.5 truncate">
                                          <Mail size={10} /> {(rec.emails as string[])[0]}
                                        </span>
                                      )}
                                      {String(rec.companyName) && (
                                        <span className="flex items-center gap-0.5 truncate">
                                          <Building2 size={10} /> {String(rec.companyName)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-gray-300 flex-shrink-0">
                                    {String(rec.createdDate)}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ background: '#015035' }}
                                  >
                                    {String(rec.name ?? '')[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{String(rec.name)}</p>
                                    <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                                      {String(rec.industry ?? '') && (
                                        <span className="truncate">{String(rec.industry)}</span>
                                      )}
                                      {String(rec.website ?? '') && (
                                        <span className="truncate">{String(rec.website)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-gray-300 flex-shrink-0">
                                    {String(rec.createdDate)}
                                  </div>
                                </div>
                              )}
                              {isSelected && (
                                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  Keep
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>

                      <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
                        <button
                          onClick={() => handleIgnore(group)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-gray-500 text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <EyeOff size={13} /> Ignore
                        </button>
                        <button
                          onClick={() => setMergingGroup(group)}
                          disabled={!selectedPrimary[group.key]}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                          style={{ background: '#015035' }}
                        >
                          <GitMerge size={13} /> Merge
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {mergingGroup && (
        <MergePreview
          type={type}
          records={mergingGroup.records}
          primaryId={selectedPrimary[mergingGroup.key]}
          onConfirm={(pid, mids, overrides) => handleMerge(pid, mids, overrides)}
          onCancel={() => setMergingGroup(null)}
        />
      )}

      {merging && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <Loader2 size={18} className="animate-spin" style={{ color: '#015035' }} />
            <span className="text-sm font-medium text-gray-700">Merging records...</span>
          </div>
        </div>
      )}
    </>
  )
}
