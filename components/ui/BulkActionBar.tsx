'use client'

import { Trash2, Download, Tag, X } from 'lucide-react'

interface BulkAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface BulkActionBarProps {
  selectedCount: number
  actions: BulkAction[]
  onDeselectAll: () => void
}

export default function BulkActionBar({ selectedCount, actions, onDeselectAll }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-2 sm:gap-3 bg-gray-900 text-white rounded-2xl shadow-2xl px-3 sm:px-5 py-3 max-w-[calc(100vw-32px)] overflow-x-auto">
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
          {selectedCount}
        </span>
        <div className="w-px h-5 bg-white/20 flex-shrink-0" />
        <div className="flex items-center gap-1">
          {actions.map(action => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px] ${
                action.variant === 'danger'
                  ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-white/20 flex-shrink-0" />
        <button
          onClick={onDeselectAll}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors whitespace-nowrap min-h-[36px]"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

export { type BulkAction }
