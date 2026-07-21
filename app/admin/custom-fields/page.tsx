'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { SlidersHorizontal, Plus, Trash2, Loader2 } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldType } from '@/lib/types'

const ENTITY_TABS: { value: CustomFieldEntityType; label: string }[] = [
  { value: 'contacts', label: 'Contacts' },
  { value: 'companies', label: 'Companies' },
  { value: 'deals', label: 'Deals' },
]

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'select', label: 'Dropdown' },
]

export default function CustomFieldsAdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CustomFieldEntityType>('contacts')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [optionsText, setOptionsText] = useState('')

  // AUDIT #241 — this page had no useAuth()/admin gate at all, unlike every
  // sibling /admin/* page (per #163's precedent) — and unlike #163's own
  // finding, the backend here genuinely doesn't require admin either (fixed
  // separately in app/api/custom-field-definitions/route.ts), so this gap
  // was a real access-control hole, not a cosmetic one.
  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.replace('/admin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    fetch('/api/custom-field-definitions')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setDefinitions(data) })
      .catch(() => toast('Failed to load custom fields', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = useMemo(
    () => definitions.filter(d => d.entityType === activeTab),
    [definitions, activeTab],
  )

  function resetForm() {
    setLabel('')
    setFieldType('text')
    setOptionsText('')
    setShowAdd(false)
  }

  async function handleAdd() {
    if (!label.trim()) return
    setSaving(true)
    try {
      const options = fieldType === 'select'
        ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
        : []
      const res = await fetch('/api/custom-field-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), entityType: activeTab, fieldType, options }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create field', 'error')
        return
      }
      setDefinitions(prev => [...prev, data])
      toast(`Field "${data.label}" added`, 'success')
      resetForm()
    } catch {
      toast('Failed to create field', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, fieldLabel: string) {
    if (!confirm(`Delete the "${fieldLabel}" field? Values already saved on records won't show anywhere once deleted.`)) return
    const removed = definitions.find(d => d.id === id)
    setDefinitions(prev => prev.filter(d => d.id !== id))
    try {
      const res = await fetch(`/api/custom-field-definitions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Field deleted', 'success')
    } catch {
      if (removed) setDefinitions(prev => [...prev, removed])
      toast('Failed to delete field', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Custom Fields" subtitle="Define extra fields to track on contacts, companies, and deals" />

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            {ENTITY_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => { setActiveTab(t.value); resetForm() }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  activeTab === t.value ? 'bg-[#015035] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#015035' }}
          >
            <Plus size={15} /> Add Field
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 mb-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Label</label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Referral Source"
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Type</label>
                <select
                  value={fieldType}
                  onChange={e => setFieldType(e.target.value as CustomFieldType)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {fieldType === 'select' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Options (comma-separated)</label>
                <input
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  placeholder="e.g. Tier 1, Tier 2, Tier 3"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!label.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Add Field
              </button>
              <button onClick={resetForm} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingScreen />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <SlidersHorizontal size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No custom fields yet for {ENTITY_TABS.find(t => t.value === activeTab)?.label.toLowerCase()}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {filtered.map(def => (
              <div key={def.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{def.label}</p>
                  {def.fieldType === 'select' && def.options.length > 0 && (
                    <p className="text-xs text-gray-400 truncate">{def.options.join(', ')}</p>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                  {FIELD_TYPES.find(t => t.value === def.fieldType)?.label ?? def.fieldType}
                </span>
                <button
                  onClick={() => handleDelete(def.id, def.label)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete field"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
