'use client'

import { Trash2, X } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            variant === 'danger' ? 'bg-red-100' : 'bg-gray-100'
          }`}>
            <Trash2 size={18} className={variant === 'danger' ? 'text-red-500' : 'text-gray-500'} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'text-white hover:opacity-90'
            }`}
            style={variant !== 'danger' ? { background: '#015035' } : undefined}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
