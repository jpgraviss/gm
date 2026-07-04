'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, ArrowLeft, X } from 'lucide-react'
import ClientDashboard from '@/components/portal/ClientDashboard'

export default function PortalPreviewPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const company = searchParams.get('company') || ''
  const [companyName, setCompanyName] = useState(company)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user?.isAdmin) {
      router.replace('/admin')
      return
    }
    requestAnimationFrame(() => setAuthorized(true))
  }, [user, authLoading, router])

  useEffect(() => {
    if (!company) return
    fetch(`/api/portal/preview?company=${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.company?.name) setCompanyName(data.company.name)
      })
      .catch(() => {})
  }, [company])

  if (authLoading || !authorized) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
        <div className="text-center">
          <Eye size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No company specified</p>
          <p className="text-xs text-gray-400 mt-1">Add ?company=CompanyName to the URL.</p>
          <button
            onClick={() => router.push('/admin/portal-management')}
            className="mt-4 text-xs font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: '#015035' }}
          >
            Go to Portal Management
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-2.5 text-xs font-semibold text-amber-800 bg-amber-100 border-b border-amber-300 flex-shrink-0 z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-amber-600" />
          <span>Viewing portal as: <strong>{companyName}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/portal-management')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 transition-colors text-amber-900"
          >
            <ArrowLeft size={12} /> Back to Portal Management
          </button>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 transition-colors text-amber-900"
          >
            <X size={12} /> Exit Preview
          </button>
        </div>
      </div>
      <ClientDashboard companyOverride={company} />
    </div>
  )
}
