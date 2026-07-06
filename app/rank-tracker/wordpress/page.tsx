'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { useToast } from '@/components/ui/Toast'
import {
  Globe, Shield, AlertTriangle, CheckCircle, RefreshCw, ChevronRight,
  ChevronDown, Package, Palette, Lock, Search, ExternalLink, X, Copy,
  Eye, Settings, Activity,
} from 'lucide-react'

interface SiteHealth {
  id: string
  company_name: string
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

function SecurityCheck({ label, safe, detail }: { label: string; safe: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {safe ? (
        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
      )}
      <span className="text-sm text-gray-700 flex-1">{label}</span>
      {detail && <span className="text-xs text-gray-400">{detail}</span>}
    </div>
  )
}

export default function WordPressSeoPage() {
  const { toast } = useToast()
  const [sites, setSites] = useState<SiteHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<SiteHealth | null>(null)
  const [scores, setScores] = useState<SeoScore[]>([])
  const [settings, setSettings] = useState<SeoSetting[]>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [tab, setTab] = useState<'health' | 'scores' | 'meta'>('health')
  const [editingMeta, setEditingMeta] = useState<SeoSetting | null>(null)
  const [metaDraft, setMetaDraft] = useState({ metaTitle: '', metaDescription: '', ogTitle: '', ogDescription: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/wordpress/seo/health')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setSites(data) })
      .catch(() => toast('Failed to load WordPress sites', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  function selectSite(site: SiteHealth) {
    setSelectedSite(site)
    setTab('health')
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
      setSettings(prev => prev.map(s => s.id === editingMeta.id ? updated : s))
      setEditingMeta(null)
      toast('SEO settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const pluginUpdates = selectedSite?.plugins.filter(p => p.update_available).length ?? 0
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, sc) => s + sc.score, 0) / scores.length) : 0

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
        {sites.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Globe size={40} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-2">No WordPress Sites Connected</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              Install the GravHub SEO plugin on client WordPress sites. Once connected, site health data and SEO scores will appear here.
            </p>
            <a
              href="/api/wordpress/plugin/download"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: '#015035' }}
            >
              <Package size={14} /> Download Plugin (.zip)
            </a>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sites list */}
            <div className="w-72 flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Connected Sites ({sites.length})
                </p>
                <a
                  href="/api/wordpress/plugin/download"
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Download Plugin"
                >
                  <Package size={13} className="text-gray-400" />
                </a>
              </div>
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
              {!selectedSite ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <Search size={32} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">Select a site to view details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tabs */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {([
                      { key: 'health' as const, label: 'Health', icon: <Activity size={14} /> },
                      { key: 'scores' as const, label: `SEO Scores (${scores.length})`, icon: <Search size={14} /> },
                      { key: 'meta' as const, label: 'Managed Meta', icon: <Settings size={14} /> },
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
                    <div className="space-y-4">
                      {/* Version info */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Environment</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">WordPress</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{selectedSite.wp_version ?? '—'}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">PHP</p>
                            <p className="text-lg font-bold text-gray-900 mt-1">{selectedSite.php_version ?? '—'}</p>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-xl">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Avg SEO Score</p>
                            <p className="text-lg font-bold mt-1" style={{ color: avgScore >= 80 ? '#015035' : avgScore >= 50 ? '#b07d10' : '#c0392b' }}>{avgScore || '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Security */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Shield size={15} style={{ color: '#015035' }} /> Security
                        </h3>
                        <SecurityCheck label="Login page protected" safe={!selectedSite.security.login_exposed} />
                        <SecurityCheck label="XML-RPC disabled" safe={!selectedSite.security.xmlrpc_enabled} />
                        <SecurityCheck label="Directory listing disabled" safe={!selectedSite.security.directory_listing} />
                        <SecurityCheck label="Sitemap accessible" safe={selectedSite.security.sitemap_found === true} />
                      </div>

                      {/* Plugins */}
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
                          {selectedSite.plugins.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                              <span className="text-gray-700 flex-1 truncate">{p.name}</span>
                              <span className="text-xs text-gray-400">{p.version}</span>
                              {p.update_available && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">UPDATE</span>
                              )}
                            </div>
                          ))}
                          {selectedSite.plugins.length === 0 && (
                            <p className="text-xs text-gray-400">No plugins reported</p>
                          )}
                        </div>
                      </div>

                      {/* Themes */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Palette size={15} style={{ color: '#015035' }} /> Themes
                        </h3>
                        <div className="space-y-1">
                          {selectedSite.themes.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                              <span className="text-gray-700 flex-1">{t.name}</span>
                              <span className="text-xs text-gray-400">{t.version}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : tab === 'scores' ? (
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
                              <tr key={sc.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-900 truncate max-w-[200px]">{sc.page_title ?? sc.page_path}</p>
                                  <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{sc.page_path}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <ScoreBadge score={sc.score} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-0.5">
                                    {sc.issues.slice(0, 3).map((issue, i) => (
                                      <div key={i} className="flex items-center gap-1.5">
                                        <SeverityDot severity={issue.severity} />
                                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{issue.message}</span>
                                      </div>
                                    ))}
                                    {sc.issues.length > 3 && (
                                      <span className="text-[10px] text-gray-300">+{sc.issues.length - 3} more</span>
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
                  ) : (
                    <div className="space-y-4">
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
                                id: sc.id,
                                site_url: sc.site_url,
                                page_path: sc.page_path,
                                meta_title: null,
                                meta_description: null,
                                og_title: null,
                                og_description: null,
                                og_image: null,
                                schema_markup: null,
                              } as SeoSetting))).map(s => (
                                <tr key={s.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate max-w-[150px]">{s.page_path}</td>
                                  <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[180px]">{s.meta_title ?? <span className="text-gray-300">Not set</span>}</td>
                                  <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[180px]">{s.meta_description ?? <span className="text-gray-300">Not set</span>}</td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => startEditMeta(s)}
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
                    </div>
                  )}
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
