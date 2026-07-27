'use client'

import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

// Batch 5 of the /portal → /client merge — "View as Client" preview.
//
// Every /client/* page previously read `user?.company` directly, which only
// works for a real client session. Staff previewing a client's portal
// (the "Preview" action in app/admin/portal-management/page.tsx, formerly
// a link to /portal/preview → <ClientDashboard companyOverride=.../>) have
// no client session at all — they're an admin staff user. This hook is the
// /client-tree equivalent of ClientDashboard's `companyOverride` prop: when
// an isAdmin staff user hits any /client/* route with ?company=<name> in
// the URL, every page reads that company's data instead of their own
// (nonexistent) client company. Non-admin staff and real client sessions
// are unaffected — the override only ever activates for isAdmin === true.
export interface ClientCompanyInfo {
  company: string
  contactName: string
  isPreview: boolean
}

export function useClientCompany(): ClientCompanyInfo {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const previewCompany = user?.isAdmin ? searchParams.get('company') : null

  if (previewCompany) {
    return { company: previewCompany, contactName: user?.name ?? 'Staff Preview', isPreview: true }
  }
  return { company: user?.company ?? '', contactName: user?.name ?? '', isPreview: false }
}
