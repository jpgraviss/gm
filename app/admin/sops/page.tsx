'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { useAuth } from '@/contexts/AuthContext'
import {
  Printer, Plus, Trash2, Pencil, GripVertical, Check, X,
  ChevronUp, ChevronDown, Search, Save, Loader2,
} from 'lucide-react'

interface SOPSection {
  id: string
  title: string
  description: string
  steps: string[]
  tips?: string[]
}

const DEFAULT_SOPS: SOPSection[] = [
  {
    id: 'new-client-onboarding',
    title: 'New Client Onboarding',
    description: 'Steps for onboarding a new client from CRM to delivery.',
    steps: [
      'Create a new contact in the CRM with the client\'s business info and assign a deal.',
      'Send a proposal via the Proposal Builder. Include scope, pricing, and timeline.',
      'Once the proposal is accepted, generate a contract and send for e-signature.',
      'After the contract is signed, create an invoice for the first billing period.',
      'Set up the project in Projects with tasks based on the 8-step delivery system.',
      'Provision portal access for the client so they can track progress.',
      'Schedule the kickoff call and send the welcome email from the portal.',
      'Assign the account manager and delivery team members to the project.',
    ],
    tips: [
      'Use the 8-step system: Discovery, Strategy, Setup, Build, Launch, Optimize, Report, Renew.',
      'Always send the welcome email within 24 hours of contract signing.',
    ],
  },
  {
    id: 'portal-management',
    title: 'Portal Management',
    description: 'How to manage client portal access and configuration.',
    steps: [
      'Navigate to Admin > Portal Management to view all portal clients.',
      'Click "Invite Client" to send a portal setup link via email.',
      'The client completes setup by setting a password and verifying their email.',
      'Approve the client in the admin panel once setup is complete.',
      'Assign services and projects to control what the client can see in their portal.',
      'Use the visibility settings to show/hide reports, invoices, and project details.',
      'Review portal activity in the audit log to track client engagement.',
    ],
    tips: [
      'Approval notifications are configurable in Settings > Notifications > Approval Settings.',
      'Clients only see data explicitly assigned to their portal account.',
    ],
  },
  {
    id: 'proposal-to-contract',
    title: 'Proposal to Contract Flow',
    description: 'End-to-end flow from proposal creation to signed contract.',
    steps: [
      'Open the CRM and navigate to the deal you want to send a proposal for.',
      'Click "Create Proposal" and use the Proposal Builder to add sections, pricing, and terms.',
      'Preview the proposal and send it to the client via email.',
      'Track the proposal status in the Proposals tab (Sent, Viewed, Accepted, Declined).',
      'When the client accepts, click "Generate Contract" to auto-fill contract details.',
      'Review the contract, add any custom clauses, and send for e-signature.',
      'Once signed, the deal stage updates automatically and an invoice can be generated.',
    ],
    tips: [
      'Proposals can be duplicated to save time on similar deals.',
      'Use engagement tracking to see when a client opens or views a proposal.',
    ],
  },
  {
    id: 'monthly-reporting',
    title: 'Monthly Reporting',
    description: 'How to generate and deliver monthly client reports.',
    steps: [
      'Navigate to the client\'s project and click "Generate Report".',
      'Select the reporting period and the metrics to include (traffic, rankings, conversions).',
      'Review the auto-generated report and add any custom commentary.',
      'Send the report to the client via email or make it available in their portal.',
      'Log the report delivery as a CRM activity for tracking.',
    ],
    tips: [
      'Reports pull data from connected integrations (Google Analytics, Search Console, etc.).',
      'Schedule reports in advance using the automation engine for recurring delivery.',
    ],
  },
  {
    id: 'rank-tracker',
    title: 'Rank Tracker',
    description: 'Setting up and using keyword rank tracking.',
    steps: [
      'Go to Rank Tracker and click "Add Keywords" for a client.',
      'Enter target keywords, select the search engine, and set the location.',
      'Connect Google Search Console to pull actual ranking data automatically.',
      'Review ranking trends on the dashboard and identify opportunities.',
      'Share rank reports with clients by enabling the data in their portal.',
    ],
    tips: [
      'GSC sync runs daily. Manual refreshes are available for on-demand checks.',
      'Group keywords by topic or landing page for cleaner reporting.',
    ],
  },
  {
    id: 'ticket-handling',
    title: 'Ticket Handling',
    description: 'Process for handling support tickets from clients.',
    steps: [
      'Tickets arrive in the CRM from client portal submissions or internal creation.',
      'Triage the ticket: assign a priority (Low, Medium, High, Urgent) and owner.',
      'Respond to the client within the SLA window (Urgent: 1 hour, High: 4 hours, Medium: 1 business day, Low: 2 business days).',
      'Update the ticket status as work progresses (Open, In Progress, Waiting, Resolved).',
      'Close the ticket once the client confirms resolution.',
      'Log time spent on the ticket for accurate billing and capacity tracking.',
    ],
    tips: [
      'Use canned responses for common issues to speed up reply times.',
      'Escalate tickets that exceed SLA thresholds to the team lead immediately.',
    ],
  },
  {
    id: 'time-tracking',
    title: 'Time Tracking',
    description: 'How to track and approve time entries.',
    steps: [
      'Open Time Tracking from the sidebar and click "Start Timer" or "Log Time".',
      'Select the client, project, and task associated with the time entry.',
      'Add a description of the work performed.',
      'Submit the time entry for approval at the end of each day or week.',
      'Managers review and approve timesheets in the Time Tracking admin view.',
      'Approved time feeds into billing calculations and project profitability reports.',
    ],
    tips: [
      'Use the running timer for real-time tracking during active work.',
      'Review weekly summaries to catch missing entries before the approval deadline.',
    ],
  },
  {
    id: 'settings-configuration',
    title: 'Settings & Configuration',
    description: 'Guide to configuring platform settings.',
    steps: [
      'Company: Set your business name, address, phone, and timezone in Settings > Company.',
      'Branding: Customize colors, logo text, and app name in Settings > Branding.',
      'Email Defaults: Configure from name, reply-to address, and footer text in Settings > Email Defaults.',
      'Email Templates: Customize system email templates (welcome, notifications) in Settings > Email Templates.',
      'Integrations: Connect Google, Gmail, and other services in Settings > Integrations.',
      'CRM Setup: Configure pipelines, stages, service types, and contact tags in Settings > CRM Setup.',
      'Notifications: Set activity notification channels and quiet hours in Settings > Notifications.',
      'Navigation: Customize sidebar layout and role-based visibility in Settings > Navigation.',
    ],
    tips: [
      'Changes to branding and email defaults apply globally across all emails and the portal.',
      'Use role-based navigation to show different sidebar items to different team roles.',
    ],
  },
]

function generateId() {
  return 'sop-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

export default function SOPsPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [sections, setSections] = useState<SOPSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState<string | null>(null)
  const [editingStep, setEditingStep] = useState<{ sectionId: string; stepIdx: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingSectionAfter, setAddingSectionAfter] = useState<string | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionDesc, setNewSectionDesc] = useState('')
  const [deletingSection, setDeletingSection] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      router.replace('/admin')
    }
  }, [user, authLoading, router])

  // Load SOPs from API (fall back to defaults)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.sops && Array.isArray(data.sops) && data.sops.length > 0) {
          setSections(data.sops)
          setActiveSection(data.sops[0]?.id || '')
        } else {
          setSections(DEFAULT_SOPS)
          setActiveSection(DEFAULT_SOPS[0].id)
        }
      })
      .catch(() => {
        setSections(DEFAULT_SOPS)
        setActiveSection(DEFAULT_SOPS[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  // Save SOPs to API
  async function saveSections(updated: SOPSection[]) {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sops: updated }),
      })
      if (!res.ok) throw new Error()
      setDirty(false)
      toast('SOPs saved', 'success')
    } catch {
      toast('Failed to save SOPs', 'error')
    }
    setSaving(false)
  }

  function updateSections(updated: SOPSection[]) {
    setSections(updated)
    setDirty(true)
  }

  // -- Section CRUD --
  function addSection(afterId: string | null) {
    if (!newSectionTitle.trim()) return
    const newSection: SOPSection = {
      id: generateId(),
      title: newSectionTitle.trim(),
      description: newSectionDesc.trim(),
      steps: ['New step - click to edit'],
      tips: [],
    }
    const updated = [...sections]
    if (afterId) {
      const idx = updated.findIndex(s => s.id === afterId)
      updated.splice(idx + 1, 0, newSection)
    } else {
      updated.push(newSection)
    }
    updateSections(updated)
    setActiveSection(newSection.id)
    setAddingSectionAfter(null)
    setNewSectionTitle('')
    setNewSectionDesc('')
  }

  function deleteSection(id: string) {
    const updated = sections.filter(s => s.id !== id)
    updateSections(updated)
    setDeletingSection(null)
    if (activeSection === id && updated.length > 0) {
      setActiveSection(updated[0].id)
    }
  }

  function startEditTitle(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    setEditingTitle(sectionId)
    setEditValue(section.title)
  }

  function commitEditTitle() {
    if (!editingTitle) return
    if (editValue.trim()) {
      updateSections(sections.map(s => s.id === editingTitle ? { ...s, title: editValue.trim() } : s))
    }
    setEditingTitle(null)
    setEditValue('')
  }

  function startEditDesc(sectionId: string) {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    setEditingDesc(sectionId)
    setEditValue(section.description)
  }

  function commitEditDesc() {
    if (!editingDesc) return
    updateSections(sections.map(s => s.id === editingDesc ? { ...s, description: editValue.trim() } : s))
    setEditingDesc(null)
    setEditValue('')
  }

  // -- Step CRUD --
  function startEditStep(sectionId: string, stepIdx: number) {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    setEditingStep({ sectionId, stepIdx })
    setEditValue(section.steps[stepIdx])
  }

  function commitEditStep() {
    if (!editingStep) return
    if (editValue.trim()) {
      updateSections(sections.map(s => {
        if (s.id !== editingStep.sectionId) return s
        const steps = [...s.steps]
        steps[editingStep.stepIdx] = editValue.trim()
        return { ...s, steps }
      }))
    }
    setEditingStep(null)
    setEditValue('')
  }

  function addStep(sectionId: string) {
    updateSections(sections.map(s => {
      if (s.id !== sectionId) return s
      return { ...s, steps: [...s.steps, 'New step - click to edit'] }
    }))
    // Auto-start editing the new step
    const section = sections.find(s => s.id === sectionId)
    if (section) {
      setTimeout(() => startEditStep(sectionId, section.steps.length), 50)
    }
  }

  function removeStep(sectionId: string, stepIdx: number) {
    updateSections(sections.map(s => {
      if (s.id !== sectionId) return s
      const steps = s.steps.filter((_, i) => i !== stepIdx)
      return { ...s, steps: steps.length > 0 ? steps : ['New step - click to edit'] }
    }))
  }

  function moveStep(sectionId: string, stepIdx: number, direction: 'up' | 'down') {
    updateSections(sections.map(s => {
      if (s.id !== sectionId) return s
      const steps = [...s.steps]
      const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1
      if (targetIdx < 0 || targetIdx >= steps.length) return s
      ;[steps[stepIdx], steps[targetIdx]] = [steps[targetIdx], steps[stepIdx]]
      return { ...s, steps }
    }))
  }

  // -- Search --
  const filteredSections = searchQuery.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.steps.some(step => step.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.tips || []).some(tip => tip.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sections

  // Focus inputs when editing starts
  useEffect(() => {
    if (editingTitle !== null || editingStep !== null) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
    if (editingDesc !== null) {
      editTextareaRef.current?.focus()
      editTextareaRef.current?.select()
    }
  }, [editingTitle, editingDesc, editingStep])

  if (loading) {
    return (
      <>
        <Header title="Standard Operating Procedures" subtitle="Internal team reference" />
        <LoadingScreen />
      </>
    )
  }

  return (
    <>
      <Header title="Standard Operating Procedures" subtitle="Internal team reference" />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto print:p-0">
        <div className="flex items-center justify-between mb-6 print:hidden gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search SOPs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-green-700"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={() => saveSections(sections)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: '#015035' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button
              onClick={() => {
                setAddingSectionAfter(null)
                setNewSectionTitle('')
                setNewSectionDesc('')
                setAddingSectionAfter('__new_at_end__')
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus size={14} /> Add Section
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Add section form at end */}
        {addingSectionAfter === '__new_at_end__' && (
          <div className="bg-white rounded-xl border-2 border-dashed border-green-300 p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3">New SOP Section</h3>
            <div className="flex flex-col gap-3">
              <input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                placeholder="Section title"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addSection(null) }}
              />
              <input
                value={newSectionDesc}
                onChange={e => setNewSectionDesc(e.target.value)}
                placeholder="Brief description (optional)"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-700"
                onKeyDown={e => { if (e.key === 'Enter') addSection(null) }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => addSection(null)}
                  disabled={!newSectionTitle.trim()}
                  className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ background: '#015035' }}
                >
                  Add Section
                </button>
                <button
                  onClick={() => setAddingSectionAfter(null)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Table of Contents */}
          <nav className="hidden lg:block w-56 flex-shrink-0 print:hidden">
            <div className="sticky top-20 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Table of Contents</h3>
              <ul className="space-y-1">
                {filteredSections.map((s, i) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setActiveSection(s.id)
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                        activeSection === s.id
                          ? 'bg-[#015035]/10 text-[#015035] font-semibold'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}. {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Sections */}
          <div className="flex-1 min-w-0 space-y-8">
            {filteredSections.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400">
                  {searchQuery ? 'No SOPs match your search.' : 'No SOPs yet. Add a section to get started.'}
                </p>
              </div>
            )}
            {filteredSections.map((section, sectionIdx) => (
              <section
                key={section.id}
                id={section.id}
                className="bg-white rounded-xl border border-gray-200 p-5 sm:p-7 print:border-0 print:shadow-none print:p-4 print:break-inside-avoid"
              >
                {/* Section header */}
                <div className="flex items-start gap-3 mb-2 group">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0 mt-0.5" style={{ background: '#015035' }}>
                    {sectionIdx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {editingTitle === section.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEditTitle(); if (e.key === 'Escape') { setEditingTitle(null); setEditValue('') } }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-lg font-bold text-gray-900 focus:outline-none focus:border-green-700"
                          style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
                        />
                        <button onClick={commitEditTitle} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={16} /></button>
                        <button onClick={() => { setEditingTitle(null); setEditValue('') }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={16} /></button>
                      </div>
                    ) : (
                      <h2
                        className="text-lg font-bold text-gray-900 cursor-pointer hover:text-[#015035] transition-colors"
                        style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
                        onClick={() => startEditTitle(section.id)}
                        title="Click to edit title"
                      >
                        {section.title}
                      </h2>
                    )}

                    {editingDesc === section.id ? (
                      <div className="flex items-start gap-2 mt-1">
                        <textarea
                          ref={editTextareaRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditDesc() } if (e.key === 'Escape') { setEditingDesc(null); setEditValue('') } }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-500 focus:outline-none focus:border-green-700 resize-none"
                          rows={2}
                        />
                        <button onClick={commitEditDesc} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                        <button onClick={() => { setEditingDesc(null); setEditValue('') }} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                      </div>
                    ) : (
                      section.description && (
                        <p
                          className="text-xs text-gray-400 mt-1 cursor-pointer hover:text-gray-600 transition-colors"
                          onClick={() => startEditDesc(section.id)}
                          title="Click to edit description"
                        >
                          {section.description}
                        </p>
                      )
                    )}
                  </div>

                  {/* Section actions */}
                  <div className="flex items-center gap-1 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditTitle(section.id)}
                      className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Edit title"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingSection(section.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete section"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Delete confirmation */}
                {deletingSection === section.id && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 ml-10">
                    <p className="text-xs text-red-700 flex-1">Delete &quot;{section.title}&quot;? This cannot be undone.</p>
                    <button onClick={() => deleteSection(section.id)} className="px-3 py-1 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600">Delete</button>
                    <button onClick={() => setDeletingSection(null)} className="px-3 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                )}

                {/* Steps */}
                <ol className="space-y-2 mb-5 ml-10">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 group/step items-start">
                      {/* Reorder buttons */}
                      <div className="flex flex-col items-center gap-0 print:hidden opacity-0 group-hover/step:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                        <button
                          onClick={() => moveStep(section.id, i, 'up')}
                          disabled={i === 0}
                          className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp size={11} />
                        </button>
                        <GripVertical size={11} className="text-gray-300" />
                        <button
                          onClick={() => moveStep(section.id, i, 'down')}
                          disabled={i === section.steps.length - 1}
                          className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>

                      <span className="flex-shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                        {i + 1}
                      </span>

                      {editingStep?.sectionId === section.id && editingStep?.stepIdx === i ? (
                        <div className="flex-1 flex items-start gap-2">
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitEditStep(); if (e.key === 'Escape') { setEditingStep(null); setEditValue('') } }}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-700 focus:outline-none focus:border-green-700"
                          />
                          <button onClick={commitEditStep} className="p-1 text-green-600 hover:bg-green-50 rounded flex-shrink-0"><Check size={14} /></button>
                          <button onClick={() => { setEditingStep(null); setEditValue('') }} className="p-1 text-gray-400 hover:bg-gray-100 rounded flex-shrink-0"><X size={14} /></button>
                        </div>
                      ) : (
                        <p
                          className="text-sm text-gray-700 leading-relaxed flex-1 cursor-pointer hover:text-[#015035] transition-colors"
                          onClick={() => startEditStep(section.id, i)}
                          title="Click to edit"
                        >
                          {step}
                        </p>
                      )}

                      {/* Remove step */}
                      <button
                        onClick={() => removeStep(section.id, i)}
                        className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded print:hidden opacity-0 group-hover/step:opacity-100 transition-all flex-shrink-0"
                        title="Remove step"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ol>

                {/* Add step button */}
                <div className="ml-10 print:hidden">
                  <button
                    onClick={() => addStep(section.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-dashed border-gray-300 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Plus size={12} /> Add Step
                  </button>
                </div>

                {/* Tips */}
                {section.tips && section.tips.length > 0 && (
                  <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-4 mt-4 ml-10">
                    <p className="text-[10px] font-bold text-[#015035] uppercase tracking-wider mb-2">Tips</p>
                    <ul className="space-y-1.5">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-xs text-gray-600">
                          <span className="text-[#015035] font-bold flex-shrink-0">*</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-8 print:mt-4">
          Graviss Marketing - Internal SOPs
        </p>
      </div>

      <style jsx global>{`
        @media print {
          nav, header, button, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .print\\:border-0 { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:p-4 { padding: 1rem !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mt-4 { margin-top: 1rem !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </>
  )
}
