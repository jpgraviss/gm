'use client'

import { Plus, X } from 'lucide-react'
import { SERVICE_NAMES } from '@/lib/services'
import { computeLineItemsBreakdown } from '@/lib/deal-line-items'
import { formatCurrency } from '@/lib/utils'
import type { DealLineItem, ServiceType } from '@/lib/types'

// Shared by NewDealPanel (creation) and the pipeline page's deal-edit form —
// lets a deal be tracked as multiple products/services at different rates
// ("$25.5K one-time sales enablement + $57K recurring 6-month engagement")
// instead of one opaque value field. See lib/deal-line-items.ts for how
// these roll up into a deal's `value`/`serviceTypes`.

interface Props {
  items: DealLineItem[]
  onChange: (items: DealLineItem[]) => void
}

function newLineItem(): DealLineItem {
  return {
    id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    serviceType: SERVICE_NAMES[0] as ServiceType,
    billingType: 'one-time',
    amount: 0,
  }
}

export default function DealLineItemsEditor({ items, onChange }: Props) {
  const breakdown = computeLineItemsBreakdown(items)

  function updateItem(id: string, patch: Partial<DealLineItem>) {
    onChange(items.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeItem(id: string) {
    onChange(items.filter(item => item.id !== id))
  }

  function addItem() {
    onChange([...items, newLineItem()])
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.id} className="flex flex-col gap-1.5 p-2.5 border border-gray-200 rounded-xl bg-white">
          <div className="flex items-center gap-1.5">
            <select
              value={item.serviceType}
              onChange={e => updateItem(item.id, { serviceType: e.target.value as ServiceType })}
              className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {SERVICE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
              aria-label="Remove line item"
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={item.amount || ''}
                onChange={e => updateItem(item.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full text-xs border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
              {(['one-time', 'recurring'] as const).map(bt => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => updateItem(item.id, { billingType: bt, ...(bt === 'one-time' ? { termMonths: undefined } : {}) })}
                  className={`text-[11px] font-medium px-2 py-1.5 transition-colors ${
                    item.billingType === bt ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {bt === 'one-time' ? 'One-time' : 'Recurring'}
                </button>
              ))}
            </div>
            {item.billingType === 'recurring' && (
              <input
                type="number"
                min="1"
                placeholder="Months"
                value={item.termMonths ?? ''}
                onChange={e => updateItem(item.id, { termMonths: Number(e.target.value) || undefined })}
                className="w-20 flex-shrink-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
      >
        <Plus size={13} /> Add Line Item
      </button>

      {items.length > 0 && (
        <div className="flex items-center justify-between text-xs px-1 pt-1">
          <span className="text-gray-400">
            One-time {formatCurrency(breakdown.oneTime)} · Recurring {formatCurrency(breakdown.recurring)}
          </span>
          <span className="font-bold text-gray-800">{formatCurrency(breakdown.total)}</span>
        </div>
      )}
    </div>
  )
}
