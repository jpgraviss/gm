'use client'

// AUDIT.md #400 + #137 — Project.contractId was a real, persisted, mapped
// column that nothing ever set (NewProjectModal hardcoded contractId: ''
// on every create, no UI displayed/edited it). These two small modals are
// the "real UI path" the audit called for: converting an executed contract
// into a brand-new linked project, or linking an already-existing project
// (scoped to the same company, since a company can have several concurrent
// projects across different contracts — a company-name fallback match
// would be too rough here, unlike the invoice case in #134).

import { useState, useMemo } from 'react'
import { X, FolderKanban, Link2, Search } from 'lucide-react'
import type { Contract, Project, ServiceType } from '@/lib/types'
import { SERVICE_NAMES } from '@/lib/services'
import { useToast } from '@/components/ui/Toast'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{children}</label>
}

export function ConvertToProjectModal({
  contract, onClose, onCreated,
}: {
  contract: Contract
  onClose: () => void
  onCreated: (project: Project) => void
}) {
  const { toast } = useToast()
  const [serviceType, setServiceType] = useState<ServiceType>(contract.serviceType)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          company: contract.company,
          companyId: contract.companyId ?? null,
          serviceType,
          status: 'Not Started',
          startDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to create project', 'error')
        setSaving(false)
        return
      }
      toast('Project created and linked to contract', 'success')
      onCreated(data)
    } catch {
      toast('Failed to create project', 'error')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white text-sm font-bold">Convert to Project</h2>
            <p className="text-white/50 text-xs mt-0.5">{contract.company} · {contract.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/60" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            Creates a new project for <span className="font-semibold text-gray-700">{contract.company}</span>, linked back to this contract.
          </p>
          <div>
            <FieldLabel>Service Type</FieldLabel>
            <select
              value={serviceType}
              onChange={e => setServiceType(e.target.value as ServiceType)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {SERVICE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            <span className="flex items-center justify-center gap-1.5"><FolderKanban size={14} /> Create Project</span>
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function LinkExistingProjectModal({
  contract, projects, onClose, onLinked,
}: {
  contract: Contract
  projects: Project[]
  onClose: () => void
  onLinked: (project: Project) => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Scoped to the same company — with multiple concurrent projects possible
  // per company across different contracts, a broader match would be an
  // unreliable guess at which project this contract actually belongs to.
  const companyProjects = useMemo(() => {
    const scoped = contract.companyId
      ? projects.filter(p => p.companyId === contract.companyId)
      : projects.filter(p => p.company.toLowerCase() === contract.company.toLowerCase())
    const q = search.trim().toLowerCase()
    if (!q) return scoped
    return scoped.filter(p => p.serviceType.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
  }, [projects, contract.companyId, contract.company, search])

  async function handleLink() {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'Failed to link project', 'error')
        setSaving(false)
        return
      }
      toast('Project linked to contract', 'success')
      onLinked(data)
    } catch {
      toast('Failed to link project', 'error')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[80vh]">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0" style={{ background: '#012b1e' }}>
          <div>
            <h2 className="text-white text-sm font-bold">Link Existing Project</h2>
            <p className="text-white/50 text-xs mt-0.5">{contract.company} · {contract.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X size={16} className="text-white/60" />
          </button>
        </div>
        <div className="p-4 flex-shrink-0 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search this company's projects…"
              className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {companyProjects.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              No projects found for {contract.company}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {companyProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedId === p.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.serviceType}</p>
                    <span className="text-[10px] font-semibold text-gray-500">{p.status}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {p.id}
                    {p.contractId && p.contractId !== contract.id && (
                      <span className="text-amber-600"> · already linked to {p.contractId}</span>
                    )}
                    {p.contractId === contract.id && (
                      <span className="text-emerald-600"> · already linked to this contract</span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button
            onClick={handleLink}
            disabled={!selectedId || saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: '#015035' }}
          >
            <span className="flex items-center justify-center gap-1.5"><Link2 size={14} /> Link Project</span>
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
