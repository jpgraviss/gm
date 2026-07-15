'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { fetchAllPages } from '@/lib/fetch-all-pages'
import CompanySelect from '@/components/ui/CompanySelect'
import { projectStatusColors, formatDate } from '@/lib/utils'
import { SERVICE_NAMES, serviceTypeColors } from '@/lib/services'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Project, ProjectStatus } from '@/lib/types'
import {
  X, CheckCircle, Calendar, ChevronRight, LayoutList, LayoutGrid,
  TrendingUp, Globe, BarChart2,
  Share2, Mail, Palette, Wrench,
  Search, FolderKanban, Activity, PauseCircle, Briefcase,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useTeamMembers } from '@/lib/useTeamMembers'
import FileUpload from '@/components/ui/FileUpload'

const DEPARTMENTS = [...SERVICE_NAMES]

const statusOrder: ProjectStatus[] = [
  'Not Started', 'In Progress', 'Awaiting Client', 'Completed', 'Launched', 'In Maintenance',
]

const statusColumnColors: Record<ProjectStatus, string> = {
  'Not Started': '#9ca3af',
  'In Progress': '#3b82f6',
  'Awaiting Client': '#f59e0b',
  'Completed': '#22c55e',
  'Launched': '#10b981',
  'In Maintenance': '#8b5cf6',
}

type FilterTab = 'All' | 'Active' | 'Completed' | 'On Hold'

const serviceTypeIcons: Partial<Record<string, React.ReactNode>> = {
  'Website Build': <Globe size={14} />,
  'Website Management': <Globe size={14} />,
  'SEO / AEO': <BarChart2 size={14} />,
  'Social Media': <Share2 size={14} />,
  'Email Marketing': <Mail size={14} />,
  'Fractional CMO': <Briefcase size={14} />,
  'Sales Training': <TrendingUp size={14} />,
  'Sales Enablement': <Briefcase size={14} />,
  'Sales Coaching': <TrendingUp size={14} />,
  'Sales Enablement Support': <Briefcase size={14} />,
  'Fractional Sales Lead / CRO': <Briefcase size={14} />,
  // Legacy values, kept so pre-existing project records still show an icon
  Website: <Globe size={14} />,
  SEO: <BarChart2 size={14} />,
  Branding: <Palette size={14} />,
  Custom: <Wrench size={14} />,
}

function ProjectGridCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = project.tasks.filter(t => !t.completed && t.dueDate < today).length

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate">{project.company}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(project.serviceTypes && project.serviceTypes.length > 0 ? project.serviceTypes : [project.serviceType]).map((st, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-400">{serviceTypeIcons[st]}</span>
                <span className="text-xs text-gray-500">{st}</span>
              </span>
            ))}
          </div>
        </div>
        <StatusBadge label={project.status} colorClass={projectStatusColors[project.status]} />
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-bold text-gray-900">{project.progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${project.progress}%`, background: project.progress === 100 ? '#22c55e' : '#015035' }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex -space-x-2">
          {project.assignedTeam.slice(0, 4).map((name, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm"
              style={{ background: i === 0 ? '#015035' : i === 1 ? '#3b82f6' : i === 2 ? '#8b5cf6' : '#6b7280' }}
              title={name}
            >
              {name.split(' ').map(n => n[0]).join('')}
            </div>
          ))}
          {project.assignedTeam.length > 4 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-500">
              +{project.assignedTeam.length - 4}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {overdueTasks > 0 && (
            <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-semibold">
              {overdueTasks} overdue
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={11} />
            {new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProjectFile {
  name: string
  size: number
  url: string
  path: string
  type: string
  createdAt?: string
}

function ProjectFilesTab({ company }: { company: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/files?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setFiles(data.map((f: ProjectFile) => ({ ...f, type: f.type ?? '' }))) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [company])

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Loading files...</div>

  return (
    <div className="flex flex-col gap-4">
      <FileUpload
        company={company}
        files={files}
        onUpload={file => setFiles(prev => [file, ...prev])}
        onRemove={file => {
          fetch('/api/files', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: file.path }),
          })
          setFiles(prev => prev.filter(f => f.path !== file.path))
        }}
      />
    </div>
  )
}

function NewProjectModal({ onClose, onSave }: { onClose: () => void; onSave: (p: Project) => void }) {
  const { toast } = useToast()
  const OWNERS = useTeamMembers()
  const [company, setCompany] = useState('')
  const [serviceType, setServiceType] = useState<Project['serviceType']>('Website Build')
  const [startDate, setStartDate] = useState('')
  const [launchDate, setLaunchDate] = useState('')
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>('Not Started')
  const [selectedTeam, setSelectedTeam] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const canSave = company.trim()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const payload = {
      contractId: '',
      company: company.trim(),
      serviceType,
      status: projectStatus,
      startDate,
      launchDate,
      assignedTeam: selectedTeam,
      progress: 0,
      milestones: [],
      tasks: [],
    }
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const saved = await res.json()
        onSave(saved)
        onClose()
      } else {
        toast('Failed to create project. Please try again.', 'error')
        setSaving(false)
        return
      }
    } catch {
      toast('Failed to create project. Please try again.', 'error')
      setSaving(false)
      return
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 pointer-events-auto overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between" style={{ background: '#012b1e' }}>
          <h2 className="text-white text-sm font-bold">New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={16} className="text-white/60" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Name *</label>
            <CompanySelect value={company} onChange={(name) => setCompany(name)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Type</label>
            <select value={serviceType} onChange={e => setServiceType(e.target.value as Project['serviceType'])}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              {SERVICE_NAMES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
            <select value={projectStatus} onChange={e => setProjectStatus(e.target.value as ProjectStatus)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700 bg-white">
              {statusOrder.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Launch Date</label>
              <input type="date" value={launchDate} onChange={e => setLaunchDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Owners</label>
            <div className="flex gap-3 flex-wrap mb-3">
              {OWNERS.map(o => (
                <label key={o} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={selectedTeam.includes(o)}
                    onChange={e => setSelectedTeam(prev => e.target.checked ? [...prev, o] : prev.filter(x => x !== o))}
                    className="rounded border-gray-300 text-green-700 focus:ring-green-700" />
                  {o}
                </label>
              ))}
            </div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Departments</label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(d => (
                <label key={d} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${selectedTeam.includes(d) ? 'bg-green-50 border-green-600 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selectedTeam.includes(d)}
                    onChange={e => setSelectedTeam(prev => e.target.checked ? [...prev, d] : prev.filter(x => x !== d))}
                    className="hidden" />
                  {d}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
            style={{ background: '#015035' }}
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [localProjects, setLocalProjects] = useState<Project[]>([])
  const [creatingProject, setCreatingProject] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterTab, setFilterTab] = useState<FilterTab>('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    // /api/projects is cursor-paginated (100/page) — fetchAllPages()
    // follows X-Next-Cursor to completion instead of a raw fetch() that
    // would silently show only the newest page as "the full list."
    fetchAllPages<Project>('/api/projects')
      .then(setLocalProjects)
      .catch(() => toast('Failed to load projects', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const totalProjects = localProjects.length
  const activeProjects = localProjects.filter(p => ['In Progress', 'Not Started'].includes(p.status))
  const completedProjects = localProjects.filter(p => ['Completed', 'Launched'].includes(p.status))
  const avgProgress = totalProjects > 0 ? Math.round(localProjects.reduce((s, p) => s + p.progress, 0) / totalProjects) : 0

  const filtered = useMemo(() => {
    let result = localProjects

    if (filterTab === 'Active') {
      result = result.filter(p => ['In Progress', 'Not Started'].includes(p.status))
    } else if (filterTab === 'Completed') {
      result = result.filter(p => ['Completed', 'Launched', 'In Maintenance'].includes(p.status))
    } else if (filterTab === 'On Hold') {
      result = result.filter(p => p.status === 'Awaiting Client')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.company.toLowerCase().includes(q) ||
        p.serviceType.toLowerCase().includes(q) ||
        (p.serviceTypes ?? []).some(st => st.toLowerCase().includes(q))
      )
    }

    return result
  }, [localProjects, filterTab, searchQuery])

  const filterTabs: { key: FilterTab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'All', label: 'All', count: localProjects.length, icon: <FolderKanban size={14} /> },
    { key: 'Active', label: 'Active', count: activeProjects.length, icon: <Activity size={14} /> },
    { key: 'Completed', label: 'Completed', count: completedProjects.length, icon: <CheckCircle size={14} /> },
    { key: 'On Hold', label: 'On Hold', count: localProjects.filter(p => p.status === 'Awaiting Client').length, icon: <PauseCircle size={14} /> },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>

  return (
    <>
      <Header title="Projects" subtitle="Track delivery across all service lines" action={{ label: 'New Project', onClick: () => setCreatingProject(true) }} />
      <div className="page-content">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Projects', value: totalProjects.toString(), icon: <Briefcase size={18} />, color: '#015035', change: `${totalProjects} total` },
            { label: 'Active', value: activeProjects.length.toString(), icon: <Activity size={18} />, color: '#3b82f6', change: 'In progress' },
            { label: 'Completed', value: completedProjects.length.toString(), icon: <CheckCircle size={18} />, color: '#22c55e', change: 'Delivered' },
            { label: 'Avg Progress', value: `${avgProgress}%`, icon: <TrendingUp size={18} />, color: '#8b5cf6', change: 'Across all' },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${m.color}12` }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <span className="text-[11px] text-gray-400 font-medium">{m.change}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{m.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6 mb-5">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filterTab === t.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  filterTab === t.key ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                title="List view"
              >
                <LayoutList size={16} />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <FolderKanban size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No projects found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery ? `No results for "${searchQuery}"` : 'Try changing the filter or create a new project'}
            </p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectGridCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-4">
              {filtered.map(p => (
                <div key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer active:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-gray-900">{p.company}</span>
                    <StatusBadge label={p.status} colorClass={projectStatusColors[p.status]} />
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(p.serviceTypes && p.serviceTypes.length > 0 ? p.serviceTypes : [p.serviceType]).map((st, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="text-gray-400">{serviceTypeIcons[st]}</span>
                          <span className="text-gray-700">{st}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Progress</span>
                      <span className="text-xs font-bold" style={{ color: '#015035' }}>{p.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.progress}%`, background: p.progress === 100 ? '#22c55e' : '#015035' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <FolderKanban size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No projects match your search.</p>
                </div>
              )}
            </div>
            {/* Desktop table view */}
            <div className="overflow-x-auto hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Progress</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Team</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Launch</th>
                  <th className="py-3 px-4 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => {
                  const overdueTasks = p.tasks.filter(t => !t.completed && t.dueDate < today).length
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-gray-900">{p.company}</p>
                        {overdueTasks > 0 && (
                          <span className="text-[10px] text-red-600 font-medium">{overdueTasks} overdue</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(p.serviceTypes && p.serviceTypes.length > 0 ? p.serviceTypes : [p.serviceType]).map((st, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="text-gray-400">{serviceTypeIcons[st]}</span>
                              <span className="text-sm text-gray-600">{st}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge label={p.status} colorClass={projectStatusColors[p.status]} />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.progress}%`, background: p.progress === 100 ? '#22c55e' : '#015035' }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 tabular-nums">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <div className="flex -space-x-1.5">
                          {p.assignedTeam.slice(0, 3).map((name, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                              style={{ background: i === 0 ? '#015035' : i === 1 ? '#3b82f6' : '#6b7280' }}
                              title={name}
                            >
                              {name.split(' ').map(n => n[0]).join('')}
                            </div>
                          ))}
                          {p.assignedTeam.length > 3 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-semibold text-gray-500">
                              +{p.assignedTeam.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{formatDate(p.launchDate)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {creatingProject && (
        <NewProjectModal
          onClose={() => setCreatingProject(false)}
          onSave={p => setLocalProjects(prev => [p, ...prev])}
        />
      )}
    </>
  )
}
