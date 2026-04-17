'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface ClientIntegrationBinding {
  id?: string
  companyId?: string
  companyName: string
  gscSiteUrl?: string
  ga4PropertyId?: string
  ga4PropertyLabel?: string
  adsCustomerId?: string
  adsCustomerLabel?: string
  metaAdAccountId?: string
  metaAdAccountLabel?: string
  gbpLocationName?: string
  gbpLocationLabel?: string
  portalEnabled: boolean
  portalWidgets: string[]
}

interface Props {
  companyName: string
  companyId?: string
  onClose: () => void
}

const ALL_WIDGETS = [
  { id: 'seo',        label: 'SEO (Search Console)' },
  { id: 'traffic',    label: 'Traffic (Analytics)' },
  { id: 'ads',        label: 'Ads performance' },
  { id: 'reputation', label: 'Reputation (Business Profile)' },
  { id: 'rankings',   label: 'Keyword rankings' },
  { id: 'uptime',     label: 'Site uptime' },
]

export default function ClientIntegrationsPanel({ companyName, companyId, onClose }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [binding, setBinding] = useState<ClientIntegrationBinding>({
    companyName,
    companyId,
    portalEnabled: false,
    portalWidgets: ['seo', 'traffic', 'ads', 'reputation', 'rankings', 'uptime'],
  })

  useEffect(() => {
    fetch(`/api/client-integrations?company=${encodeURIComponent(companyName)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ClientIntegrationBinding[]) => {
        if (Array.isArray(data) && data.length > 0) setBinding({ ...data[0], companyName })
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoading(false))
  }, [companyName])

  async function save() {
    setSaving(true)
    try {
      if (binding.id) {
        const res = await fetch(`/api/client-integrations/${binding.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(binding),
        })
        if (!res.ok) { toast('Failed to save', 'error'); setSaving(false); return }
      } else {
        const res = await fetch('/api/client-integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(binding),
        })
        if (!res.ok) { toast('Failed to save', 'error'); setSaving(false); return }
        const created = await res.json()
        setBinding({ ...created, companyName })
      }
      toast('Integrations saved', 'success')
      setSaving(false)
    } catch {
      toast('Failed to save', 'error')
      setSaving(false)
    }
  }

  function toggleWidget(id: string) {
    setBinding((b) => ({
      ...b,
      portalWidgets: b.portalWidgets.includes(id)
        ? b.portalWidgets.filter((w) => w !== id)
        : [...b.portalWidgets, id],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="pointer-events-auto bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 w-full sm:w-[min(560px,100vw)] overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#012b1e' }}>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm truncate">Client Integrations</h2>
            <p className="text-white/60 text-xs truncate">{companyName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 flex items-start gap-3">
                <Sparkles size={16} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Bind this client to specific properties in each integration, then enable the portal
                  view so they can see their own SEO, traffic, and reputation data in real time.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search Console site URL</label>
                <input
                  value={binding.gscSiteUrl ?? ''}
                  onChange={(e) => setBinding((b) => ({ ...b, gscSiteUrl: e.target.value }))}
                  placeholder="sc-domain:site.com or https://site.com/"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GA4 property ID</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={binding.ga4PropertyId ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, ga4PropertyId: e.target.value }))}
                    placeholder="123456789"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <input
                    value={binding.ga4PropertyLabel ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, ga4PropertyLabel: e.target.value }))}
                    placeholder="Label (optional)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Google Ads customer ID</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={binding.adsCustomerId ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, adsCustomerId: e.target.value }))}
                    placeholder="123-456-7890"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <input
                    value={binding.adsCustomerLabel ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, adsCustomerLabel: e.target.value }))}
                    placeholder="Label (optional)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Meta ad account ID</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={binding.metaAdAccountId ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, metaAdAccountId: e.target.value }))}
                    placeholder="act_1234567890"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <input
                    value={binding.metaAdAccountLabel ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, metaAdAccountLabel: e.target.value }))}
                    placeholder="Label (optional)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Business Profile location</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={binding.gbpLocationName ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, gbpLocationName: e.target.value }))}
                    placeholder="accounts/xxx/locations/yyy"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <input
                    value={binding.gbpLocationLabel ?? ''}
                    onChange={(e) => setBinding((b) => ({ ...b, gbpLocationLabel: e.target.value }))}
                    placeholder="Label (optional)"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binding.portalEnabled}
                    onChange={(e) => setBinding((b) => ({ ...b, portalEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-gray-800">Show in client portal</span>
                </label>
                <p className="text-[11px] text-gray-500 mb-3">
                  When enabled, the client will see their own live data on the Insights tab of their portal.
                </p>

                {binding.portalEnabled && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Widgets visible to client</p>
                    {ALL_WIDGETS.map((w) => (
                      <label key={w.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={binding.portalWidgets.includes(w.id)}
                          onChange={() => toggleWidget(w.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-gray-700">{w.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: '#015035' }}
              >
                {saving ? 'Saving…' : <><CheckCircle size={14} /> Save Bindings</>}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
