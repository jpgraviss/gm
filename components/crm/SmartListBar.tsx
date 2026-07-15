'use client'

import { useState, useEffect } from 'react'
import { Bookmark, Plus, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { SavedFilter, SavedFilterEntityType } from '@/lib/types'

interface SmartListBarProps {
  entityType: SavedFilterEntityType
  currentCriteria: Record<string, string>
  onApply: (criteria: Record<string, string>) => void
}

export default function SmartListBar({ entityType, currentCriteria, onApply }: SmartListBarProps) {
  const { toast } = useToast()
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    fetch(`/api/saved-filters?entityType=${entityType}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: SavedFilter[]) => setFilters(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [entityType])

  function apply(filter: SavedFilter | null) {
    setActiveId(filter?.id ?? null)
    onApply(filter?.criteria ?? {})
  }

  async function handleSave() {
    const name = saveName.trim()
    if (!name) return
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, entityType, criteria: currentCriteria }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json() as SavedFilter
      setFilters(prev => [created, ...prev])
      setActiveId(created.id)
      setShowSave(false)
      setSaveName('')
      toast(`Smart list "${name}" saved`, 'success')
    } catch {
      toast('Failed to save smart list', 'error')
    }
  }

  async function handleDelete(id: string) {
    setFilters(prev => prev.filter(f => f.id !== id))
    if (activeId === id) apply(null)
    try {
      const res = await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      toast('Failed to delete smart list', 'error')
    }
  }

  const hasCriteria = Object.values(currentCriteria).some(v => v && v !== 'All')

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map(f => (
        <div
          key={f.id}
          className={`group flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
            activeId === f.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={activeId === f.id ? { background: '#015035' } : undefined}
          onClick={() => apply(activeId === f.id ? null : f)}
        >
          <Bookmark size={11} />
          {f.name}
          <button
            onClick={e => { e.stopPropagation(); handleDelete(f.id) }}
            className={`rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${activeId === f.id ? 'hover:bg-white/20' : 'hover:bg-gray-300'}`}
            title="Delete smart list"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      {hasCriteria && (
        <button
          onClick={() => setShowSave(true)}
          className="flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          <Plus size={11} /> Save as smart list
        </button>
      )}
      {showSave && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSave(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Save smart list</p>
              <p className="text-xs text-gray-500 mt-0.5">Save the current filter so it re-applies against live data anytime</p>
            </div>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="e.g. Hot leads touched this week"
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!saveName.trim()} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#015035' }}>Save</button>
              <button onClick={() => setShowSave(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
