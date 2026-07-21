'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react'
import { useEnrichment } from '@/lib/useEnrichment'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import { useToast } from '@/components/ui/Toast'

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Legal', 'Non-Profit', 'Other',
] as const

interface Company {
  id: string
  name: string
  industry?: string
  website?: string
}

interface Props {
  value: string
  onChange: (name: string, companyId?: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export default function CompanySelect({ value, onChange, placeholder = 'Select a company...', disabled, required, className }: Props) {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIndustry, setNewIndustry] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const { enriching, enrich } = useEnrichment()
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    // Was a raw fetch() against a route cursor-paginated at 100 rows
    // server-side — any org with more than 100 companies silently only
    // ever saw the first 100 in this search/dropdown, with real companies
    // past that point invisible and unselectable everywhere this component
    // is used (contacts, tickets, invoices, projects, ...).
    fetchAllPages<Company>('/api/crm/companies')
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setSearch('')
      setCreating(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = search.trim()
    ? companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies

  function handleSelect(company: Company) {
    onChange(company.name, company.id)
    setOpen(false)
  }

  async function handleNewWebsiteBlur() {
    if (!newWebsite.trim() || enriching) return
    const data = await enrich(newWebsite)
    if (!data) return
    if (data.name && !newName) setNewName(data.name)
    if (data.industry && !newIndustry) setNewIndustry(data.industry)
  }

  function openCreateForm() {
    setNewName(search)
    setNewIndustry('')
    setNewWebsite('')
    setCreating(true)
  }

  function cancelCreate() {
    setCreating(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreateLoading(true)
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), industry: newIndustry || undefined, website: newWebsite.trim() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create company')
      }
      const created: Company = await res.json()
      setCompanies(prev => [...prev, created])
      onChange(created.name, created.id)
      setOpen(false)
    } catch (err) {
      // keep form open on error
      toast(err instanceof Error ? err.message : 'Failed to create company', 'error')
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={`w-full flex items-center gap-2 text-left text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white
          focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:cursor-not-allowed
          ${!value ? 'text-gray-400' : 'text-gray-900'}`}
      >
        <Building2 size={14} className="text-gray-400 flex-shrink-0" />
        <span className="flex-1 truncate">{value || placeholder}</span>
        {value && !disabled ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(''); }}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {!creating && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <Search size={13} className="text-gray-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
            </div>
          )}
          {creating ? (
            <div className="p-3 space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Company name"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={newIndustry}
                onChange={e => setNewIndustry(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-700"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <div className="relative">
                <input
                  value={newWebsite}
                  onChange={e => setNewWebsite(e.target.value)}
                  onBlur={handleNewWebsiteBlur}
                  placeholder="Website (optional)"
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {enriching && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-blue-600">
                    <Loader2 size={10} className="animate-spin" />
                  </span>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createLoading}
                  className="flex-1 text-xs font-medium text-white rounded-lg py-1.5 disabled:opacity-50"
                  style={{ background: '#015035' }}
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={cancelCreate}
                  disabled={createLoading}
                  className="flex-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg py-1.5 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    {search ? `No companies match "${search}"` : 'No companies found'}
                  </p>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors hover:bg-emerald-50 ${
                        value === c.name ? 'bg-emerald-50 text-emerald-800' : 'text-gray-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: '#015035' }}>
                        {c.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.industry && <p className="text-[10px] text-gray-400">{c.industry}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={openCreateForm}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-emerald-50 border-t border-gray-100"
                style={{ color: '#015035' }}
              >
                <Plus size={14} />
                Add New Company
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
