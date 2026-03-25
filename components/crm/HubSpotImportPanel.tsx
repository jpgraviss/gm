'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileText, CheckCircle, AlertCircle, Building2, Users, TrendingUp } from 'lucide-react'

type ImportType = 'companies' | 'contacts' | 'deals'

interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

interface Props {
  onClose: () => void
  onComplete?: () => void
  defaultType?: ImportType
}

// Simple CSV parser that handles quoted fields
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header
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

const typeConfig: Record<ImportType, { icon: typeof Building2; label: string; description: string; columns: string[] }> = {
  companies: {
    icon: Building2,
    label: 'Companies',
    description: 'Import companies from HubSpot',
    columns: ['Company Name', 'Industry', 'Website', 'Phone', 'City/HQ', 'Number of Employees', 'Annual Revenue', 'Lifecycle Stage', 'Owner'],
  },
  contacts: {
    icon: Users,
    label: 'Contacts',
    description: 'Import contacts from HubSpot',
    columns: ['First Name', 'Last Name', 'Email', 'Company', 'Job Title', 'Phone', 'Lifecycle Stage', 'Owner'],
  },
  deals: {
    icon: TrendingUp,
    label: 'Deals',
    description: 'Import deals from HubSpot',
    columns: ['Deal Name / Company', 'Deal Stage', 'Amount', 'Close Date', 'Deal Owner', 'Contact Name', 'Contact Email'],
  },
}

export default function HubSpotImportPanel({ onClose, onComplete, defaultType }: Props) {
  const [type, setType] = useState<ImportType>(defaultType ?? 'companies')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const handleImport = async () => {
    if (!preview.length) return
    setImporting(true)
    setError('')
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
      }
    } catch {
      setError('Import failed. Please try again.')
    }
    setImporting(false)
  }

  const columns = preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      <div className="flex-1 pointer-events-auto" onClick={onClose} />
      <div className="bg-white h-full shadow-2xl flex flex-col pointer-events-auto overflow-hidden border-l border-gray-200" style={{ width: 'min(600px, 100vw)' }}>
        {/* Header */}
        <div className="p-6 flex-shrink-0" style={{ background: '#012b1e' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-base">Import from HubSpot</h2>
              <p className="text-white/50 text-xs mt-0.5">Upload a CSV export from HubSpot</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <X size={16} className="text-white/70" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What are you importing?</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(typeConfig) as [ImportType, typeof typeConfig[ImportType]][]).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={key}
                    onClick={() => { setType(key); setFile(null); setPreview([]); setResult(null); setError('') }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                      type === key
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-500'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs font-semibold">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Expected columns hint */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Expected HubSpot columns for {typeConfig[type].label}:</p>
            <p className="text-xs text-blue-600">{typeConfig[type].columns.join(', ')}</p>
            <p className="text-[11px] text-blue-500 mt-1">Column names are matched flexibly — most HubSpot export formats will work automatically.</p>
          </div>

          {/* File upload */}
          {!result && (
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

          {/* Preview */}
          {preview.length > 0 && !result && (
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
                        {columns.length > 6 && <td className="px-3 py-2 text-gray-400">…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <CheckCircle size={32} className="mx-auto mb-3 text-emerald-600" />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Import Complete</h3>
              <div className="flex justify-center gap-6 mt-3">
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped (duplicates)</p>
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
              <button
                onClick={handleImport}
                disabled={importing || preview.length === 0}
                className="flex-1 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: '#015035' }}
              >
                {importing ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Importing {preview.length} {type}...</>
                ) : (
                  <>Import {preview.length > 0 ? `${preview.length} ${type}` : typeConfig[type].label}</>
                )}
              </button>
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
