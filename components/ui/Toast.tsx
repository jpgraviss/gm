'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

interface ToastContextType {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const config = {
    error:   { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: <AlertCircle size={16} className="text-red-500" /> },
    success: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: <CheckCircle size={16} className="text-emerald-500" /> },
    info:    { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: <Info size={16} className="text-blue-500" /> },
  }[toast.type]

  return (
    <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-right ${config.bg}`}>
      <span className="flex-shrink-0 mt-0.5">{config.icon}</span>
      <p className={`text-sm ${config.text} flex-1`}>{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 mt-0.5">
        <X size={14} className="text-gray-400 hover:text-gray-600" />
      </button>
    </div>
  )
}
