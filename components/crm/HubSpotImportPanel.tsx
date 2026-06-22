'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, CheckCircle, AlertCircle, Building2, Users, TrendingUp, Cloud, FileUp, RefreshCw, Undo2, GitMerge } from 'lucide-react'

type ImportType = 'companies' | 'contacts' | 'deals'
type ImportMode = 'csv' | 'api'

interface ImportResult {
  inserted: number
  updated?: number
  skipped: number
  errors: string[]
  batchId?: string
}

interface ApiRecord {
  hubspotId: string
  [key: string]: string
}

interface Props {
  onClose: () => void
  onComplete?: () => void
  onShowDuplicates?: () => void
  defaultType?: ImportType
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length === 0) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

const typeConfig: Record<ImportType, { icon: typeof Building2; label: string; description: string; columns: string[]; apiEndpoint: string; responseKey: string }> = {
  contacts: {
    icon: Users,
    label: 'Contacts',
    description: 'Import contacts from HubSpot',
    columns: ['First Name', 'Last Name', 'Email', 'Company', 'Job Title', 'Phone', 'Lifecycle Stage', 'Owner'],
    apiEndpoint: '/api/integrations/hubspot/contacts',
    responseKey: 'contacts',
  },
  companies: {
    icon: Building2,
    label: 'Companies',
    description: 'Import companies from HubSpot',
    columns: ['Company Name', 'Industry', 'Website', 'Phone', 'City/HQ', 'Number of Employees', 'Annual Revenue', 'Lifecycle Stage', 'Owner'],
    apiEndpoint: '/api/integrations/hubspot/companies',
    responseKey: 'companies',
  },
  deals: {
    icon: TrendingUp,
    label: 'Deals',
    description: 'Import deals from HubSpot',
    columns: ['Deal Name / Company', 'Deal Stage', 'Amount', 'Close Date', 'Deal Owner', 'Contact Name', 'Contact Email'],
    apiEndpoint: '/api/integrations/hubspot/deals',
    responseKey: 'deals',
  },
}

const apiPreviewColumns: Record<ImportType, { key: string; label: string }[]> = {
  contacts: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'companyName', label: 'Company' },
    { key: 'title', label: 'Title' },
    { key: 'phone', label: 'Phone' },
    { key: 'lifecycleStage', label: 'Stage' },
  ],
  companies: [
    { key: 'name', label: 'Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'website', label: 'Website' },
    { key: 'phone', label: 'Phone' },
    { key: 'location', label: 'Location' },
    { key: 'numberOfEmployees', label: 'Employees' },
  ],
  deals: [
    { key: 'dealName', label: 'Deal Name' },
    { key: 'dealStage', label: 'Stage' },
    { key: 'amount', label: 'Amount' },
    { key: 'closeDate', label: 'Close Date' },
    { key: 'pipeline', label: 'Pipeline' },
  ],
}

function getCellValue(record: ApiRecord, type: ImportType, key: string): string {
  if (type === 'contacts' && key === 'name') {
    return `${record.firstName || ''} ${record.lastName || ''}`.trim()
  }
  if (type === 'companies' && key === 'location') {
    return [record.city, record.state, record.country].filter(Boolean).join(', ')
  }
  if (type === 'deals' && key === 'amount' && record.amount) {
    const n = parseFloat(record.amount)
    if (!isNaN(n)) return `$${n.toLocaleString()}`
  }
  if (type === 'deals' && key === 'closeDate' && record.closeDate) {
    try {
      return new Date(record.closeDate).toLocaleDateString()
    } catch { /* fall through */ }
  }
  return record[key] || ''
}

export default function HubSpotImportPanel({ onClose, onComplete, onShowDuplicates, defaultType }: Props) {
  const [type, setType] = useState<ImportType>(defaultType ?? 'contacts')
  const [mode, setMode] = useState<ImportMode>('api')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const [apiRecords, setApiRecords] = useState<ApiRecord[]>([])
  const [apiFetching, setApiFetching] = useState(false)
  const [apiNextAfter, setApiNextAfter] = useState<string | null>(null)
  const [apiLoaded, setApiLoaded] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [undone, setUndone] = useState(false)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) {
          setError('No data rows found in CSV file.')
          return
        }
        setPreview(rows)
      } catch {
        setError('Failed to parse CSV file. Make sure it\'s a valid CSV export from HubSpot.')
      }
    }
    reader.readAsText(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
      handleFile(f)
    } else {
      setError('Please upload a CSV file.')
    }
  }, [handleFile])

  const config = typeConfig[type]

  const fetchFromApi = async (reset?: boolean) => {
    setApiFetching(true)
    setError('')
    try {
      const afterParam = reset ? '' : apiNextAfter
      const url = afterParam
        ? `${config.apiEndpoint}?after=${afterParam}`
        : config.apiEndpoint
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Failed to fetch ${type} from HubSpot`)
        setApiFetching(false)
        return
      }
      const records = data[config.responseKey] ?? []
      if (reset) {
        setApiRecords(records)
      } else {
        setApiRecords(prev => [...prev, ...records])
      }
      setApiNextAfter(data.nextAfter)
      setApiLoaded(true)
    } catch {
      setError('Failed to connect to HubSpot. Check your API key in Settings.')
    }
    setApiFetching(false)
  }

  const handleCsvImport = async () => {
    if (!preview.length) return
    setImporting(true)
    setError('')
    setImportProgress(`Importing ${preview.length} ${type}...`)
    try {
      const res = await fetch('/api/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, rows: preview }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
      } else {
        setResult(data)
        onComplete?.()
        if (data.inserted > 0 && type !== 'deals') {
          try {
            const dupRes = await fetch(`/api/crm/duplicates?type=${type}`)
            if (dupRes.ok) {
              const dupData = await dupRes.json()
              setDuplicateCount((dupData.groups ?? []).length)
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setError('Import failed. Please try again.')
    }
    setImporting(false)
    setImportProgress('')
  }

  const handleApiImport = async () => {
    if (!apiRecords.length) return
    setImporting(true)
    setError('')
    setImportProgress(`Importing ${type} from HubSpot...`)
    try {
      const res = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Import failed')
      } else {
        setResult({
          inserted: data.inserted,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors,
        })
        onComplete?.()
        if (data.inserted > 0 && type !== 'deals') {
          try {
            const dupRes = await fetch(`/api/crm/duplicates?type=${type}`)
            if (dupRes.ok) {
              const dupData = await dupRes.json()
              setDuplicateCount((dupData.groups ?? []).length)
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setError('Import failed. Please try again.')
    }
    setImporting(false)
    setImportProgress('')
  }

  const handleUndo = async () => {
    if (!result?.batchId) return
    setUndoing(true)
    try {
      const res = await fetch('/api/crm/import/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: result.batchId }),
      })
      if (res.ok) {
        setUndone(true)
        onComplete?.()
      }
    } catch { /* ignore */ }
    setUndoing(false)
  }

  const columns = preview.length > 0 ? Object.keys(preview[0]) : []

  const resetState = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setError('')
    setApiRecords([])
    setApiLoaded(false)
    setApiNextAfter(null)
    setImportProgress('')
    setUndone(false)
  }

  const handleTypeChange = (newType: ImportType) => {
    setType(newType)
    resetState()
  }

  const previewCols = apiPreviewColumns[type]

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(640px, 100vw)' }}>
        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-base">Import from HubSpot</h2>
              <p className="text-white/50 text-xs mt-0.5">One-way sync: HubSpot → GravHub only</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <X size={16} className="text-white/70" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Type selector — always visible */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What are you importing?</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(typeConfig) as [ImportType, typeof typeConfig[ImportType]][]).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      type === key
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-500'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs font-semibold">{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Import mode toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Import method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setMode('api'); resetState() }}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  mode === 'api'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <Cloud size={16} />
                <div className="text-left">
                  <span className="text-xs font-semibold block">Direct API</span>
                  <span className="text-[10px] opacity-70">Pull from HubSpot live</span>
                </div>
              </button>
              <button
                onClick={() => { setMode('csv'); resetState() }}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  mode === 'csv'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-500'
                }`}
              >
                <FileUp size={16} />
                <div className="text-left">
                  <span className="text-xs font-semibold block">CSV Upload</span>
                  <span className="text-[10px] opacity-70">Upload an export file</span>
                </div>
              </button>
            </div>
          </div>

          {/* CSV mode: Expected columns hint */}
          {mode === 'csv' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Expected HubSpot columns for {config.label}:</p>
              <p className="text-xs text-blue-600">{config.columns.join(', ')}</p>
              <p className="text-[11px] text-blue-500 mt-1">Column names are matched flexibly — most HubSpot export formats will work automatically.</p>
            </div>
          )}

          {/* API mode: Fetch records */}
          {mode === 'api' && !result && (
            <div>
              {!apiLoaded ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Cloud size={28} className="mx-auto mb-3 text-gray-400" />
                  <p className="text-sm text-gray-600 font-medium mb-1">Pull {config.label.toLowerCase()} directly from HubSpot</p>
                  <p className="text-xs text-gray-400 mb-4">Uses your configured API key to fetch all {config.label.toLowerCase()}</p>
                  <button
                    onClick={() => fetchFromApi(true)}
                    disabled={apiFetching}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                    style={{ background: '#015035' }}
                  >
                    {apiFetching ? (
                      <><RefreshCw size={14} className="animate-spin" /> Fetching...</>
                    ) : (
                      <><Cloud size={14} /> Fetch {config.label}</>
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {apiRecords.length} {config.label.toLowerCase()} loaded from HubSpot
                    </p>
                    {apiNextAfter && (
                      <button
                        onClick={() => fetchFromApi()}
                        disabled={apiFetching}
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                      >
                        {apiFetching ? <RefreshCw size={12} className="animate-spin" /> : null}
                        Load more
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {previewCols.map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-gray-500">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {apiRecords.slice(0, 10).map(record => (
                          <tr key={record.hubspotId} className="border-b border-gray-100 last:border-0">
                            {previewCols.map(col => (
                              <td key={col.key} className="px-3 py-2 text-gray-700 whitespace-nowrap truncate max-w-[140px]">
                                {getCellValue(record, type, col.key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {apiRecords.length > 10 && (
                      <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                        ...and {apiRecords.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CSV mode: File upload */}
          {mode === 'csv' && !result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Upload size={24} className="mx-auto mb-2 text-gray-400" />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={14} className="text-emerald-600" />
                  <span className="text-sm text-gray-700 font-medium">{file.name}</span>
                  <span className="text-xs text-gray-400">({preview.length} rows)</span>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 font-medium">Drop your HubSpot CSV here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </div>
          )}

          {/* CSV Preview */}
          {mode === 'csv' && preview.length > 0 && !result && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview ({Math.min(preview.length, 5)} of {preview.length} rows)</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {columns.slice(0, 6).map(col => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{col}</th>
                      ))}
                      {columns.length > 6 && <th className="px-3 py-2 text-left text-gray-400">+{columns.length - 6} more</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        {columns.slice(0, 6).map(col => (
                          <td key={col} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate">{row[col]}</td>
                        ))}
                        {columns.length > 6 && <td className="px-3 py-2 text-gray-400">...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {importProgress && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <RefreshCw size={14} className="text-blue-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700">{importProgress}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              {undone ? (
                <>
                  <Undo2 size={32} className="mx-auto mb-3 text-amber-600" />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Import Undone</h3>
                  <p className="text-sm text-gray-500">All {result.inserted} imported records have been removed.</p>
                </>
              ) : (
                <>
                  <CheckCircle size={32} className="mx-auto mb-3 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Import Complete</h3>
                  <div className="flex justify-center gap-6 mt-3">
                    <div>
                      <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                      <p className="text-xs text-gray-500">Imported</p>
                    </div>
                    {(result.updated ?? 0) > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                        <p className="text-xs text-gray-500">Updated</p>
                      </div>
                    )}
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                      <p className="text-xs text-gray-500">Skipped</p>
                    </div>
                    {result.errors.length > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                        <p className="text-xs text-gray-500">Errors</p>
                      </div>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3 text-left bg-red-50 border border-red-200 rounded-lg p-3">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err}</p>
                      ))}
                      {result.errors.length > 5 && <p className="text-xs text-red-400 mt-1">... and {result.errors.length - 5} more</p>}
                    </div>
                  )}
                  {result.batchId && result.inserted > 0 && (
                    <button
                      onClick={handleUndo}
                      disabled={undoing}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {undoing ? <RefreshCw size={12} className="animate-spin" /> : <Undo2 size={12} />}
                      Undo Import
                    </button>
                  )}
                  {duplicateCount > 0 && onShowDuplicates && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-center gap-2 justify-center">
                        <GitMerge size={14} className="text-orange-600" />
                        <span className="text-sm font-semibold text-orange-800">
                          {duplicateCount} potential duplicate{duplicateCount > 1 ? 's' : ''} detected
                        </span>
                      </div>
                      <button
                        onClick={() => { onClose(); onShowDuplicates() }}
                        className="mt-2 text-xs font-semibold text-orange-700 hover:text-orange-900 underline"
                      >
                        Review Duplicates
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex gap-2">
          {result ? (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl"
              style={{ background: '#015035' }}
            >
              Done
            </button>
          ) : (
            <>
              {mode === 'csv' ? (
                <button
                  onClick={handleCsvImport}
                  disabled={importing || preview.length === 0}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: '#015035' }}
                >
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Importing {preview.length} {type}...</>
                  ) : (
                    <>Import {preview.length > 0 ? `${preview.length} ${type}` : config.label}</>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleApiImport}
                  disabled={importing || !apiLoaded || apiRecords.length === 0}
                  className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: '#015035' }}
                >
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Importing {type}...</>
                  ) : (
                    <>Import {apiRecords.length > 0 ? `${apiRecords.length} ${config.label}` : config.label} from HubSpot</>
                  )}
                </button>
              )}
              <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
