'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, Sparkles } from 'lucide-react'
import LoadingScreen from '@/components/ui/LoadingScreen'
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

// AUDIT #675 — id/idField/labelField, plus a `map` to normalize each
// integration's real, differently-shaped list response into one common
// {id, label} option shape this panel's single <PickerField> renders.
interface PickerOption {
  id: string
  label: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGscOptions(rows: any[]): PickerOption[] {
  return rows.map(r => ({ id: r.siteUrl, label: r.siteUrl }))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGa4Options(rows: any[]): PickerOption[] {
  return rows.map(r => ({ id: r.propertyId ?? r.id, label: `${r.displayName} — ${r.accountName}` }))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAdsOptions(rows: any[]): PickerOption[] {
  return rows.map(r => ({ id: r.id, label: `${r.descriptiveName || r.name} (${r.id})` }))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMetaOptions(rows: any[]): PickerOption[] {
  return rows.map(r => ({ id: r.id, label: `${r.name} (${r.id})` }))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGbpOptions(rows: any[]): PickerOption[] {
  return rows.map(r => ({ id: r.locationName, label: `${r.title}${r.address ? ` — ${r.address}` : ''}` }))
}

// A real dropdown backed by the account's already-working list endpoint
// when it loads successfully, falling back to the original free-text
// input when the integration isn't connected, the fetch fails, or the
// account genuinely isn't in the returned list — so a typo can't happen
// for the common case, but nothing is blocked when the list can't load.
function PickerField({
  endpoint,
  mapOptions,
  value,
  onChange,
  placeholder,
}: {
  endpoint: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapOptions: (rows: any[]) => PickerOption[]
  value: string
  onChange: (id: string, label?: string) => void
  placeholder: string
}) {
  const [options, setOptions] = useState<PickerOption[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)
  const [forceDropdown, setForceDropdown] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(endpoint)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((rows) => {
        if (cancelled) return
        if (!Array.isArray(rows)) throw new Error('unexpected shape')
        setOptions(mapOptions(rows))
      })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  const showDropdown = options && options.length > 0 && !manualEntry
  // A previously-saved value that isn't in the live list (removed account,
  // typed before this dropdown existed) still needs to show — falls back
  // to manual entry automatically rather than silently clearing it.
  // AUDIT #692 — this auto-fallback left the "Choose from connected accounts
  // instead" recovery button underneath dead: its onClick only reset
  // `manualEntry`, but `manualEntry` was never true in this branch (it's
  // `valueMissingFromList` keeping it here), so the click did nothing and
  // there was no way back into the dropdown short of clearing the field
  // entirely. `forceDropdown` lets that button actually override the
  // auto-fallback once the user explicitly asks to see the list.
  const valueMissingFromList = !!value && options && !options.some(o => o.id === value) && !forceDropdown

  if (showDropdown && !valueMissingFromList) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => {
            const selected = options.find(o => o.id === e.target.value)
            onChange(e.target.value, selected?.label)
          }}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        >
          <option value="">Select…</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setManualEntry(true)}
          className="text-[11px] text-gray-400 hover:text-gray-600 whitespace-nowrap flex-shrink-0"
        >
          Enter manually
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
      />
      {loadFailed && (
        <p className="text-[10px] text-gray-400">Couldn&apos;t load the connected account list (check Settings → Integrations) — enter the ID directly.</p>
      )}
      {options && options.length > 0 && (
        <button
          type="button"
          onClick={() => { setManualEntry(false); setForceDropdown(true) }}
          className="text-[11px] text-emerald-700 hover:underline self-start"
        >
          Choose from connected accounts instead
        </button>
      )}
    </div>
  )
}

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
          <LoadingScreen />
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
                <PickerField
                  endpoint="/api/integrations/gsc/properties"
                  mapOptions={mapGscOptions}
                  value={binding.gscSiteUrl ?? ''}
                  onChange={(id) => setBinding((b) => ({ ...b, gscSiteUrl: id }))}
                  placeholder="sc-domain:site.com or https://site.com/"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GA4 property</label>
                <PickerField
                  endpoint="/api/integrations/ga4/properties"
                  mapOptions={mapGa4Options}
                  value={binding.ga4PropertyId ?? ''}
                  onChange={(id, label) => setBinding((b) => ({ ...b, ga4PropertyId: id, ga4PropertyLabel: label ?? b.ga4PropertyLabel }))}
                  placeholder="123456789"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Google Ads account</label>
                <PickerField
                  endpoint="/api/integrations/ads/accounts"
                  mapOptions={mapAdsOptions}
                  value={binding.adsCustomerId ?? ''}
                  onChange={(id, label) => setBinding((b) => ({ ...b, adsCustomerId: id, adsCustomerLabel: label ?? b.adsCustomerLabel }))}
                  placeholder="123-456-7890"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Meta ad account</label>
                <PickerField
                  endpoint="/api/integrations/meta/accounts"
                  mapOptions={mapMetaOptions}
                  value={binding.metaAdAccountId ?? ''}
                  onChange={(id, label) => setBinding((b) => ({ ...b, metaAdAccountId: id, metaAdAccountLabel: label ?? b.metaAdAccountLabel }))}
                  placeholder="act_1234567890"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Business Profile location</label>
                <PickerField
                  endpoint="/api/integrations/gbp/locations"
                  mapOptions={mapGbpOptions}
                  value={binding.gbpLocationName ?? ''}
                  onChange={(id, label) => setBinding((b) => ({ ...b, gbpLocationName: id, gbpLocationLabel: label ?? b.gbpLocationLabel }))}
                  placeholder="accounts/xxx/locations/yyy"
                />
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
