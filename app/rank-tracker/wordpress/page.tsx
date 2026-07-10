'use client'

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Globe, Shield, AlertTriangle, CheckCircle, RefreshCw, ChevronDown,
  Package, Palette, Lock, Search, X, Copy,
  Settings, Activity, FileText, Key, Plus, Trash2, Download, BarChart3,
  TrendingDown, Eye, EyeOff,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface SiteHealth {
  id: string
  company_name: string
  company_id: string | null
  site_url: string
  wp_version: string | null
  php_version: string | null
  plugins: Array<{ name: string; version: string; update_available?: boolean; active?: boolean }>
  themes: Array<{ name: string; version: string; active?: boolean }>
  security: {
    login_exposed?: boolean
    xmlrpc_enabled?: boolean
    directory_listing?: boolean
    sitemap_found?: boolean
  }
  last_reported_at: string | null
}

interface CompanyOption {
  id: string
  name: string
}

interface ApiKey {
  key: string
  label: string
  createdAt: string
}

interface SeoScore {
  id: string
  site_url: string
  page_path: string
  page_title: string | null
  score: number
  issues: Array<{ type: string; message: string; severity: string }>
  checked_at: string
}

interface SeoSetting {
  id: string
  site_url: string
  page_path: string
  meta_title: string | null
  meta_description: string | null
  og_title: string | null
  og_description: string | null
  og_image: string | null
  schema_markup: Record<string, unknown> | null
}

interface SiteReport {
  siteUrl: string
  companyName: string
  generatedAt: string
  environment: {
    wpVersion: string | null
    phpVersion: string | null
    pluginCount: number
    pluginUpdates: number
    lastReported: string | null
  }
  averageScore: number
  totalPages: number
  totalIssues: number
  scoreDistribution: { green: number; yellow: number; red: number }
  topIssues: Array<{ type: string; count: number; message: string; severity: string }>
  worstPages: Array<{ path: string; title: string | null; score: number; issueCount: number }>
  securityIssues: string[]
}

// ── Utility Components ────────────────────────────────────────────────────

function ScoreCircle({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'
  const fontSize = size > 60 ? Math.round(size * 0.3) : Math.round(size * 0.35)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size / 2} y={size / 2 + fontSize / 3} textAnchor="middle" fontSize={fontSize} fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#015035' : score >= 50 ? '#b07d10' : '#c0392b'
  const bg = score >= 80 ? '#e6f0ec' : score >= 50 ? '#fef6e0' : '#fde8e6'
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-xs font-bold"
      style={{ background: bg, color }}
    >
      {score}
    </span>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'error' ? '#c0392b' : severity === 'warning' ? '#b07d10' : '#6b7280'
  return <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
}

function SecurityCheck({ label, safe }: { label: string; safe: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {safe ? (
        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
      )}
      <span className="text-sm text-gray-700 flex-1">{label}</span>
    </div>
  )
}

function ScoreBar({ green, yellow, red }: { green: number; yellow: number; red: number }) {
  const total = green + yellow + red
  if (total === 0) return null
  return (
    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
      {green > 0 && <div style={{ width: `${(green / total) * 100}%`, background: '#059669' }} />}
      {yellow > 0 && <div style={{ width: `${(yellow / total) * 100}%`, background: '#d97706' }} />}
      {red > 0 && <div style={{ width: `${(red / total) * 100}%`, background: '#dc2626' }} />}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function WordPressSeoPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<SiteHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<SiteHealth | null>(null)
  const [scores, setScores] = useState<SeoScore[]>([])
  const [settings, setSettings] = useState<SeoSetting[]>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [tab, setTab] = useState<'health' | 'scores' | 'meta' | 'reports' | 'apikeys'>('health')
  const [editingMeta, setEditingMeta] = useState<SeoSetting | null>(null)
  const [metaDraft, setMetaDraft] = useState({ metaTitle: '', metaDescription: '', ogTitle: '', ogDescription: '' })
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [report, setReport] = useState<SiteReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [showKeys, setShowKeys] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [assigningCompany, setAssigningCompany] = useState(false)

  useEffect(() => {
    fetch('/api/wordpress/seo/health')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setSites(data) })
      .catch(() => toast('Failed to load WordPress sites', 'error'))
      .finally(() => setLoading(false))

    fetch('/api/crm/companies?limit=500')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setCompanies(data) })
      .catch(() => {})

    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, unknown>) => {
        const wp = data.wordpress as { apiKeys?: Array<string | ApiKey> } | undefined
        if (wp?.apiKeys) {
          setApiKeys(wp.apiKeys.map(k =>
            typeof k === 'string' ? { key: k, label: '', createdAt: '' } : k
          ))
        }
      })
      .catch(() => {})
  }, [toast])

  const selectSite = useCallback((site: SiteHealth) => {
    setSelectedSite(site)
    setTab('health')
    setReport(null)
    setScoresLoading(true)
    Promise.all([
      fetch(`/api/wordpress/seo/scores?site=${encodeURIComponent(site.site_url)}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/wordpress/seo/settings?site=${encodeURIComponent(site.site_url)}`).then(r => r.ok ? r.json() : []),
    ])
      .then(([s, st]) => {
        setScores(Array.isArray(s) ? s : [])
        setSettings(Array.isArray(st) ? st : [])
      })
      .catch(() => toast('Failed to load site data', 'error'))
      .finally(() => setScoresLoading(false))
  }, [toast])

  async function assignCompany(siteId: string, companyId: string) {
    setAssigningCompany(true)
    try {
      const res = await fetch('/api/wordpress/seo/health', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: siteId, companyId: companyId || null }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setSites(prev => prev.map(s => s.id === siteId ? updated : s))
      setSelectedSite(prev => prev && prev.id === siteId ? updated : prev)
      toast(companyId ? 'Site assigned to client' : 'Site unassigned', 'success')
    } catch {
      toast('Failed to update client assignment', 'error')
    } finally {
      setAssigningCompany(false)
    }
  }

  function startEditMeta(setting: SeoSetting) {
    setEditingMeta(setting)
    setMetaDraft({
      metaTitle: setting.meta_title ?? '',
      metaDescription: setting.meta_description ?? '',
      ogTitle: setting.og_title ?? '',
      ogDescription: setting.og_description ?? '',
    })
  }

  async function saveMeta() {
    if (!editingMeta || !selectedSite) return
    setSaving(true)
    try {
      const res = await fetch('/api/wordpress/seo/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite.site_url,
          pagePath: editingMeta.page_path,
          metaTitle: metaDraft.metaTitle || null,
          metaDescription: metaDraft.metaDescription || null,
          ogTitle: metaDraft.ogTitle || null,
          ogDescription: metaDraft.ogDescription || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setSettings(prev => {
        const idx = prev.findIndex(s => s.id === editingMeta.id)
        if (idx >= 0) return prev.map(s => s.id === editingMeta.id ? updated : s)
        return [...prev.filter(s => s.page_path !== editingMeta.page_path), updated]
      })
      setEditingMeta(null)
      toast('SEO settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function syncSite() {
    if (!selectedSite || syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/wordpress/seo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedSite.site_url }),
      })
      const data = await res.json()
      if (data.connected) {
        toast(`Synced ${data.sync?.pages_analyzed ?? 0} pages`, 'success')
        selectSite(selectedSite)
      } else {
        toast(data.error || 'Site not reachable', 'error')
      }
    } catch {
      toast('Sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function generateReport() {
    if (!selectedSite) return
    setReportLoading(true)
    try {
      const res = await fetch('/api/wordpress/seo/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedSite.site_url }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setReport(data)
      toast('Report generated', 'success')
    } catch {
      toast('Failed to generate report', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  async function generateApiKey() {
    if (!newKeyLabel.trim()) {
      toast('Give the key a title first', 'error')
      return
    }
    setGeneratingKey(true)
    try {
      const newKey = 'ghk_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      const entry: ApiKey = { key: newKey, label: newKeyLabel.trim(), createdAt: new Date().toISOString() }
      const updated = [...apiKeys, entry]
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordpress: { apiKeys: updated } }),
      })
      if (!res.ok) throw new Error('Failed')
      setApiKeys(updated)
      setShowKeys(true)
      setNewKeyLabel('')
      await navigator.clipboard.writeText(newKey)
      toast('API key generated and copied to clipboard', 'success')
    } catch {
      toast('Failed to generate API key', 'error')
    } finally {
      setGeneratingKey(false)
    }
  }

  async function revokeApiKey(index: number) {
    const updated = apiKeys.filter((_, i) => i !== index)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordpress: { apiKeys: updated } }),
      })
      if (!res.ok) throw new Error('Failed')
      setApiKeys(updated)
      toast('API key revoked', 'success')
    } catch {
      toast('Failed to revoke API key', 'error')
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast('Copied to clipboard', 'success')
  }

  function printReport() {
    window.print()
  }

  const pluginUpdates = selectedSite?.plugins.filter(p => p.update_available).length ?? 0
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, sc) => s + sc.score, 0) / scores.length) : 0
  const greenCount = scores.filter(s => s.score >= 80).length
  const yellowCount = scores.filter(s => s.score >= 50 && s.score < 80).length
  const redCount = scores.filter(s => s.score < 50).length

  if (loading) {
    return (
      <>
        <Header title="WordPress SEO" subtitle="Manage SEO across client WordPress sites" />
        <div className="page-content flex items-center justify-center py-20">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="WordPress SEO" subtitle="Manage SEO across client WordPress sites" />
      <div className="page-content">
        {sites.length === 0 && tab !== 'apikeys' ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Globe size={40} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-2">No WordPress Sites Connected</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Install the GravHub SEO plugin on client WordPress sites. Once connected, site health data and SEO scores will appear here.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="/api/wordpress/plugin/download"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: '#015035' }}
              >
                <Download size={14} /> Download Plugin
              </a>
              <button
                onClick={() => setTab('apikeys')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Key size={14} /> Manage API Keys
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sites list */}
            <div className="w-72 flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Connected Sites ({sites.length})
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setSelectedSite(null); setTab('apikeys') }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="API Keys"
                  >
                    <Key size={13} className="text-gray-400" />
                  </button>
                  <a
                    href="/api/wordpress/plugin/download"
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Download Plugin"
                  >
                    <Package size={13} className="text-gray-400" />
                  </a>
                </div>
              </div>

              {/* API Keys management button */}
              <button
                onClick={() => { setSelectedSite(null); setTab('apikeys') }}
                className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  borderColor: tab === 'apikeys' && !selectedSite ? '#015035' : '#e5e7eb',
                  background: tab === 'apikeys' && !selectedSite ? '#f0faf5' : '#fff',
                }}
              >
                <div className="flex items-center gap-2">
                  <Key size={14} style={{ color: '#015035' }} />
                  <span className="text-sm font-semibold text-gray-900">API Keys</span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    {apiKeys.length}
                  </span>
                </div>
              </button>

              {sites.map(site => (
                <button
                  key={site.id}
                  onClick={() => selectSite(site)}
                  className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                  style={{
                    borderColor: selectedSite?.id === site.id ? '#015035' : '#e5e7eb',
                    background: selectedSite?.id === site.id ? '#f0faf5' : '#fff',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={14} style={{ color: '#015035' }} />
                    <span className="text-sm font-semibold text-gray-900 truncate">{site.company_name}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">{site.site_url}</p>
                  {site.company_id ? (
                    <p className="text-[10px] text-emerald-600 font-medium mt-1 truncate">
                      {companies.find(c => c.id === site.company_id)?.name ?? 'Linked to client'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-600 font-medium mt-1">Unassigned</p>
                  )}
                  {site.last_reported_at && (
                    <p className="text-[10px] text-gray-300 mt-1">
                      Last report: {new Date(site.last_reported_at).toLocaleDateString()}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {/* Detail panel */}
            <div className="flex-1 min-w-0">
              {/* API Keys Panel */}
              {tab === 'apikeys' && !selectedSite ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <Key size={15} style={{ color: '#015035' }} /> WordPress API Keys
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Generate API keys for the GravHub SEO WordPress plugin. Enter these in the plugin settings.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newKeyLabel}
                          onChange={e => setNewKeyLabel(e.target.value)}
                          placeholder="e.g. Graviss Marketing — main site"
                          className="text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 w-56"
                          onKeyDown={e => { if (e.key === 'Enter') generateApiKey() }}
                        />
                        <button
                          onClick={generateApiKey}
                          disabled={generatingKey}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                          style={{ background: '#015035' }}
                        >
                          <Plus size={13} /> {generatingKey ? 'Generating...' : 'Generate Key'}
                        </button>
                      </div>
                    </div>

                    {apiKeys.length === 0 ? (
                      <div className="text-center py-8">
                        <Key size={32} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-sm text-gray-400">No API keys yet</p>
                        <p className="text-xs text-gray-300 mt-1">Generate a key to connect WordPress sites</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-end mb-2">
                          <button
                            onClick={() => setShowKeys(!showKeys)}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                          >
                            {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
                            {showKeys ? 'Hide' : 'Show'} keys
                          </button>
                        </div>
                        {apiKeys.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">
                                {entry.label || 'Untitled key'}
                              </p>
                              <code className="text-xs text-gray-500 font-mono">
                                {showKeys ? entry.key : `${entry.key.slice(0, 8)}${'*'.repeat(32)}${entry.key.slice(-4)}`}
                              </code>
                            </div>
                            <button
                              onClick={() => copyToClipboard(entry.key)}
                              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                              title="Copy"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => revokeApiKey(i)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="Revoke"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Download size={15} style={{ color: '#015035' }} /> Download Plugin
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Download the GravHub SEO plugin ZIP file and upload it to your WordPress site via Plugins &gt; Add New &gt; Upload Plugin.
                    </p>
                    <a
                      href="/api/wordpress/plugin/download"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ background: '#015035' }}
                    >
                      <Download size={14} /> Download gravhub-seo.zip
                    </a>
                  </div>
                </div>
              ) : !selectedSite ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <Search size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Select a site to view details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Client assignment */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Client</span>
                    <select
                      value={selectedSite.company_id ?? ''}
                      onChange={e => assignCompany(selectedSite.id, e.target.value)}
                      disabled={assigningCompany}
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {!selectedSite.company_id && (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full whitespace-nowrap">
                        Not linked to a client
                      </span>
                    )}
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {([
                      { key: 'health' as const, label: 'Health', icon: <Activity size={14} /> },
                      { key: 'scores' as const, label: `Scores (${scores.length})`, icon: <Search size={14} /> },
                      { key: 'meta' as const, label: 'Meta', icon: <Settings size={14} /> },
                      { key: 'reports' as const, label: 'Report', icon: <FileText size={14} /> },
                    ]).map(t => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          background: tab === t.key ? '#fff' : 'transparent',
                          color: tab === t.key ? '#015035' : '#6b7280',
                          boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {scoresLoading ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
                    </div>
                  ) : tab === 'health' ? (
                    <HealthTab
                      site={selectedSite}
                      avgScore={avgScore}
                      pluginUpdates={pluginUpdates}
                      syncing={syncing}
                      onSync={syncSite}
                    />
                  ) : tab === 'scores' ? (
                    <ScoresTab scores={scores} />
                  ) : tab === 'meta' ? (
                    <MetaTab settings={settings} scores={scores} onEdit={startEditMeta} />
                  ) : tab === 'reports' ? (
                    <ReportsTab
                      site={selectedSite}
                      report={report}
                      loading={reportLoading}
                      onGenerate={generateReport}
                      onPrint={printReport}
                      greenCount={greenCount}
                      yellowCount={yellowCount}
                      redCount={redCount}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meta editor modal */}
        {editingMeta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingMeta(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Edit Meta Tags</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{editingMeta.page_path}</p>
                </div>
                <button onClick={() => setEditingMeta(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Meta Title</label>
                  <input
                    type="text"
                    value={metaDraft.metaTitle}
                    onChange={e => setMetaDraft(d => ({ ...d, metaTitle: e.target.value }))}
                    placeholder="Page title for search results"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                  />
                  <p className="text-[10px] text-gray-300 mt-1">{metaDraft.metaTitle.length}/60 characters</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Meta Description</label>
                  <textarea
                    value={metaDraft.metaDescription}
                    onChange={e => setMetaDraft(d => ({ ...d, metaDescription: e.target.value }))}
                    placeholder="Description for search results"
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
                  />
                  <p className="text-[10px] text-gray-300 mt-1">{metaDraft.metaDescription.length}/160 characters</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">OG Title (Social)</label>
                  <input
                    type="text"
                    value={metaDraft.ogTitle}
                    onChange={e => setMetaDraft(d => ({ ...d, ogTitle: e.target.value }))}
                    placeholder="Title when shared on social media"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">OG Description (Social)</label>
                  <textarea
                    value={metaDraft.ogDescription}
                    onChange={e => setMetaDraft(d => ({ ...d, ogDescription: e.target.value }))}
                    placeholder="Description when shared on social media"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#015035]/20 focus:border-[#015035] resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button onClick={() => setEditingMeta(null)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
                <button
                  onClick={saveMeta}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#015035' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Health Tab ─────────────────────────────────────────────────────────────

function HealthTab({ site, avgScore, pluginUpdates, syncing, onSync }: {
  site: SiteHealth; avgScore: number; pluginUpdates: number; syncing: boolean; onSync: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {site.last_reported_at
            ? `Last sync: ${new Date(site.last_reported_at).toLocaleString()}`
            : 'Never synced'}
        </p>
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#015035' }}
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Environment</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">WordPress</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{site.wp_version ?? '—'}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">PHP</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{site.php_version ?? '—'}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Avg SEO Score</p>
            <p className="text-lg font-bold mt-1" style={{ color: avgScore >= 80 ? '#015035' : avgScore >= 50 ? '#b07d10' : '#c0392b' }}>
              {avgScore || '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Shield size={15} style={{ color: '#015035' }} /> Security
        </h3>
        <SecurityCheck label="Login page protected" safe={!site.security.login_exposed} />
        <SecurityCheck label="XML-RPC disabled" safe={!site.security.xmlrpc_enabled} />
        <SecurityCheck label="Directory listing disabled" safe={!site.security.directory_listing} />
        <SecurityCheck label="Sitemap accessible" safe={site.security.sitemap_found === true} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Package size={15} style={{ color: '#015035' }} /> Plugins
          {pluginUpdates > 0 && (
            <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {pluginUpdates} update{pluginUpdates > 1 ? 's' : ''} available
            </span>
          )}
        </h3>
        <div className="space-y-1">
          {site.plugins.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.active !== false ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <span className="text-gray-700 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-gray-400">{p.version}</span>
              {p.update_available && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">UPDATE</span>
              )}
            </div>
          ))}
          {site.plugins.length === 0 && <p className="text-xs text-gray-400">No plugins reported</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Palette size={15} style={{ color: '#015035' }} /> Themes
        </h3>
        <div className="space-y-1">
          {site.themes.map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.active !== false ? 'bg-emerald-400' : 'bg-gray-300'}`} />
              <span className="text-gray-700 flex-1">{t.name}</span>
              <span className="text-xs text-gray-400">{t.version}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Scores Tab ────────────────────────────────────────────────────────────

function ScoresTab({ scores }: { scores: SeoScore[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {scores.length === 0 ? (
        <div className="p-12 text-center">
          <Search size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No SEO scores reported yet</p>
          <p className="text-xs text-gray-300 mt-1">Run an analysis from the WordPress plugin</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Page</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Score</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Issues</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {scores.map(sc => (
              <tr
                key={sc.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpanded(expanded === sc.id ? null : sc.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[200px]">{sc.page_title ?? sc.page_path}</p>
                  <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{sc.page_path}</p>
                  {expanded === sc.id && sc.issues.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                      {sc.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <SeverityDot severity={issue.severity} />
                          <span className="text-xs text-gray-500">{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={sc.score} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{sc.issues.length} issue{sc.issues.length !== 1 ? 's' : ''}</span>
                    {sc.issues.length > 0 && (
                      <ChevronDown size={12} className={`text-gray-300 transition-transform ${expanded === sc.id ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {new Date(sc.checked_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Meta Tab ──────────────────────────────────────────────────────────────

function MetaTab({ settings, scores, onEdit }: {
  settings: SeoSetting[]; scores: SeoScore[]; onEdit: (s: SeoSetting) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {settings.length === 0 && scores.length === 0 ? (
        <div className="p-12 text-center">
          <Settings size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No pages available for meta management</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Page</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Meta Title</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Meta Description</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(settings.length > 0 ? settings : scores.map(sc => ({
              id: sc.id, site_url: sc.site_url, page_path: sc.page_path,
              meta_title: null, meta_description: null, og_title: null,
              og_description: null, og_image: null, schema_markup: null,
            } as SeoSetting))).map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate max-w-[150px]">{s.page_path}</td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[180px]">
                  {s.meta_title ?? <span className="text-gray-300">Not set</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[180px]">
                  {s.meta_description ?? <span className="text-gray-300">Not set</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(s)}
                    className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors hover:bg-gray-100"
                    style={{ color: '#015035' }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Reports Tab ───────────────────────────────────────────────────────────

function ReportsTab({ site, report, loading, onGenerate, onPrint, greenCount, yellowCount, redCount }: {
  site: SiteHealth
  report: SiteReport | null
  loading: boolean
  onGenerate: () => void
  onPrint: () => void
  greenCount: number
  yellowCount: number
  redCount: number
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">SEO Report</h3>
          <p className="text-xs text-gray-400">Generate a comprehensive SEO report for {site.company_name}</p>
        </div>
        <div className="flex gap-2">
          {report && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <FileText size={13} /> Print / Export
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: '#015035' }}
          >
            <BarChart3 size={13} className={loading ? 'animate-pulse' : ''} />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <BarChart3 size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Click "Generate Report" to create a detailed SEO report</p>
        </div>
      ) : (
        <div className="space-y-4 print:space-y-6" id="seo-report">
          {/* Report Header */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 print:border-0 print:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{report.companyName}</h2>
                <p className="text-xs text-gray-400">{report.siteUrl}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Generated</p>
                <p className="text-xs text-gray-500">{new Date(report.generatedAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <ScoreCircle score={report.averageScore} size={70} />
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-2">Overall Score</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl flex flex-col justify-center">
                <p className="text-2xl font-bold text-gray-900">{report.totalPages}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-1">Pages Analyzed</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl flex flex-col justify-center">
                <p className="text-2xl font-bold text-gray-900">{report.totalIssues}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-1">Total Issues</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl flex flex-col justify-center">
                <p className="text-2xl font-bold text-gray-900">{report.environment.pluginCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mt-1">Active Plugins</p>
              </div>
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Distribution</h3>
            <ScoreBar green={report.scoreDistribution.green} yellow={report.scoreDistribution.yellow} red={report.scoreDistribution.red} />
            <div className="flex justify-between mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Good (80+): {report.scoreDistribution.green}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Needs Work (50-79): {report.scoreDistribution.yellow}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Poor (&lt;50): {report.scoreDistribution.red}
              </span>
            </div>
          </div>

          {/* Top Issues */}
          {report.topIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" /> Most Common Issues
              </h3>
              <div className="space-y-2">
                {report.topIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <SeverityDot severity={issue.severity} />
                    <span className="text-sm text-gray-700 flex-1">{issue.message}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {issue.count} page{issue.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst Pages */}
          {report.worstPages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown size={15} className="text-red-500" /> Pages Needing Attention
              </h3>
              <div className="space-y-2">
                {report.worstPages.map((page, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <ScoreBadge score={page.score} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{page.title ?? page.path}</p>
                      <p className="text-[11px] text-gray-400 truncate">{page.path}</p>
                    </div>
                    <span className="text-xs text-gray-400">{page.issueCount} issues</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security */}
          {report.securityIssues.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield size={15} className="text-red-500" /> Security Concerns
              </h3>
              <div className="space-y-2">
                {report.securityIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Environment */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Environment</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">WordPress</span>
                <span className="font-medium text-gray-900">{report.environment.wpVersion ?? '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">PHP</span>
                <span className="font-medium text-gray-900">{report.environment.phpVersion ?? '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Active Plugins</span>
                <span className="font-medium text-gray-900">{report.environment.pluginCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50">
                <span className="text-gray-500">Plugin Updates</span>
                <span className={`font-medium ${report.environment.pluginUpdates > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {report.environment.pluginUpdates}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-4 text-[10px] text-gray-300">
            Report generated by GravHub SEO — Graviss Marketing
          </div>
        </div>
      )}
    </div>
  )
}
