'use client'

import { useState, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldEntityType } from '@/lib/types'

interface CustomFieldsSectionProps {
  entityType: CustomFieldEntityType
  values: Record<string, string>
  editing: boolean
  onChange?: (key: string, value: string) => void
  // 'row' matches a list of border-b FieldRow-style entries (contacts'
  // About tab). 'card' matches the p-4 bg-gray-50 rounded-xl card blocks
  // used by the companies/deals detail panels.
  variant?: 'row' | 'card'
}

function formatDisplayValue(def: CustomFieldDefinition, raw: string | undefined): string {
  if (!raw) return '—'
  if (def.fieldType === 'boolean') return raw === 'true' ? 'Yes' : 'No'
  return raw
}

export default function CustomFieldsSection({ entityType, values, editing, onChange, variant = 'row' }: CustomFieldsSectionProps) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])

  useEffect(() => {
    fetch(`/api/custom-field-definitions?entityType=${entityType}`)
      .then(r => r.ok ? r.json() : [])
      .then((d: CustomFieldDefinition[]) => setDefinitions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [entityType])

  if (definitions.length === 0) return null

  if (!editing) {
    return (
      <div className={variant === 'card' ? 'p-4 bg-gray-50 rounded-xl' : 'flex flex-col gap-1 px-5 py-3 border-b border-gray-50'}>
        <span className={variant === 'card' ? 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1' : 'text-[11px] text-gray-400 font-medium flex items-center gap-1'}>
          <SlidersHorizontal size={11} /> Custom Fields
        </span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
          {definitions.map(def => (
            <div key={def.id} className="flex flex-col">
              <span className="text-[10px] text-gray-400">{def.label}</span>
              <span className="text-sm text-gray-700">{formatDisplayValue(def, values[def.fieldKey])}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
        <SlidersHorizontal size={12} /> Custom Fields
      </label>
      <div className="grid grid-cols-2 gap-3">
        {definitions.map(def => {
          const value = values[def.fieldKey] ?? ''
          if (def.fieldType === 'boolean') {
            return (
              <label key={def.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={value === 'true'}
                  onChange={e => onChange?.(def.fieldKey, e.target.checked ? 'true' : 'false')}
                  className="rounded"
                />
                {def.label}
              </label>
            )
          }
          if (def.fieldType === 'select') {
            return (
              <div key={def.id} className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">{def.label}</span>
                <select
                  value={value}
                  onChange={e => onChange?.(def.fieldKey, e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">—</option>
                  {def.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )
          }
          return (
            <div key={def.id} className="flex flex-col gap-1">
              <span className="text-[11px] text-gray-500">{def.label}</span>
              <input
                type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'}
                value={value}
                onChange={e => onChange?.(def.fieldKey, e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
