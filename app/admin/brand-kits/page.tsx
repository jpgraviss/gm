'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import CompanySelect from '@/components/ui/CompanySelect'
import { Palette, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { fetchAllPages } from '@/lib/fetch-all-pages'

interface BrandKit {
  id: string
  companyName: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  fonts: string[]
  toneOfVoice?: string
  hashtags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

const emptyForm = {
  companyName: '',
  logoUrl: '',
  primaryColor: '#015035',
  secondaryColor: '#f97316',
  fontsText: '',
  toneOfVoice: '',
  hashtagsText: '',
  notes: '',
}

export default function BrandKitsAdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [kits, setKits] = useState<BrandKit[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Same admin gate as the sibling Custom Fields page — this is a
  // Team-Member-readable, Leadership-deletable resource per the API's own
  // role checks, but the management UI itself is reached from an
  // admin-only nav section.
  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.replace('/admin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    fetchAllPages<BrandKit>('/api/brand-kits')
      .then(setKits)
      .catch(() => toast('Failed to load brand kits', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  function resetForm() {
    setForm(emptyForm)
    setShowAdd(false)
    setEditingId(null)
  }

  function startEdit(kit: BrandKit) {
    setEditingId(kit.id)
    setForm({
      companyName: kit.companyName,
      logoUrl: kit.logoUrl ?? '',
      primaryColor: kit.primaryColor ?? '#015035',
      secondaryColor: kit.secondaryColor ?? '#f97316',
      fontsText: kit.fonts.join(', '),
      toneOfVoice: kit.toneOfVoice ?? '',
      hashtagsText: kit.hashtags.join(', '),
      notes: kit.notes ?? '',
    })
    setShowAdd(true)
  }

  async function handleSave() {
    if (!form.companyName.trim()) return
    setSaving(true)
    try {
      const payload = {
        companyName: form.companyName.trim(),
        logoUrl: form.logoUrl.trim() || undefined,
        primaryColor: form.primaryColor || undefined,
        secondaryColor: form.secondaryColor || undefined,
        fonts: form.fontsText.split(',').map(f => f.trim()).filter(Boolean),
        toneOfVoice: form.toneOfVoice.trim() || undefined,
        hashtags: form.hashtagsText.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean),
        notes: form.notes.trim() || undefined,
      }
      const res = await fetch(
        editingId ? `/api/brand-kits/${editingId}` : '/api/brand-kits',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || `Failed to ${editingId ? 'update' : 'create'} brand kit`, 'error')
        return
      }
      if (editingId) {
        setKits(prev => prev.map(k => k.id === editingId ? data : k))
        toast(`Brand kit for "${data.companyName}" updated`, 'success')
      } else {
        // POST is an upsert-by-company-name (see app/api/brand-kits/route.ts)
        // — creating a kit for a company that already has one updates it in
        // place instead of erroring, so replace rather than assume append.
        setKits(prev => {
          const exists = prev.some(k => k.id === data.id || k.companyName === data.companyName)
          return exists ? prev.map(k => (k.id === data.id || k.companyName === data.companyName) ? data : k) : [data, ...prev]
        })
        toast(`Brand kit for "${data.companyName}" saved`, 'success')
      }
      resetForm()
    } catch {
      toast(`Failed to ${editingId ? 'update' : 'create'} brand kit`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, companyName: string) {
    if (!confirm(`Delete the brand kit for "${companyName}"? This can't be undone.`)) return
    const removed = kits.find(k => k.id === id)
    setKits(prev => prev.filter(k => k.id !== id))
    try {
      const res = await fetch(`/api/brand-kits/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Brand kit deleted', 'success')
    } catch {
      if (removed) setKits(prev => [...prev, removed])
      toast('Failed to delete brand kit', 'error')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Brand Kits" subtitle="Logo, colors, tone of voice, and hashtags per client — used to steer AI-generated content" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl">
        <div className="flex items-center justify-end mb-5">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#015035' }}
          >
            <Plus size={15} /> Add Brand Kit
          </button>
        </div>

        {showAdd && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 mb-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Company</label>
              <CompanySelect
                value={form.companyName}
                onChange={name => setForm(f => ({ ...f, companyName: name }))}
                disabled={!!editingId}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : '#015035'}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
                  />
                  <input
                    value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    placeholder="#015035"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.secondaryColor) ? form.secondaryColor : '#f97316'}
                    onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0"
                  />
                  <input
                    value={form.secondaryColor}
                    onChange={e => setForm(f => ({ ...f, secondaryColor: e.target.value }))}
                    placeholder="#f97316"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Logo URL</label>
              <div className="flex items-center gap-3">
                {form.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="w-9 h-9 rounded-lg border border-gray-200 object-contain flex-shrink-0 bg-gray-50" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                )}
                <input
                  value={form.logoUrl}
                  onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://..."
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Fonts (comma-separated)</label>
              <input
                value={form.fontsText}
                onChange={e => setForm(f => ({ ...f, fontsText: e.target.value }))}
                placeholder="e.g. Montserrat, Syncopate"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tone of Voice</label>
              <textarea
                rows={2}
                value={form.toneOfVoice}
                onChange={e => setForm(f => ({ ...f, toneOfVoice: e.target.value }))}
                placeholder="e.g. Confident, direct, no corporate jargon. Speaks to owner-operators, not marketers."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Hashtags (comma-separated)</label>
              <input
                value={form.hashtagsText}
                onChange={e => setForm(f => ({ ...f, hashtagsText: e.target.value }))}
                placeholder="e.g. LocalBusiness, SmallBizTips"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anything else worth knowing when writing for this client"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!form.companyName.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: '#015035' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingId ? 'Save Changes' : 'Add Brand Kit'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingScreen />
        ) : kits.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Palette size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No brand kits yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {kits.map(kit => (
              <div key={kit.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-4 h-4 rounded-full border border-gray-200" style={{ background: kit.primaryColor || '#e5e7eb' }} />
                  <span className="w-4 h-4 rounded-full border border-gray-200" style={{ background: kit.secondaryColor || '#e5e7eb' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{kit.companyName}</p>
                  {kit.toneOfVoice && <p className="text-xs text-gray-400 truncate">{kit.toneOfVoice}</p>}
                </div>
                <button
                  onClick={() => startEdit(kit)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Edit brand kit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(kit.id, kit.companyName)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete brand kit"
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
