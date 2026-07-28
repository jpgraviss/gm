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

// AUDIT.md #506 — `isPreview` above was only ever consulted for read-side/UI
// purposes (banner, notification suppression, nav links) — no /client/**
// mutation handler checked it, so a staff member previewing a client's
// account could trigger real, indistinguishable-from-genuine writes
// (signing/declining a contract, approving/rejecting a social post, replying
// to a ticket, paying an invoice). Header name matches the server-side
// check in lib/portal-auth.ts's blockIfPreview().
export const PREVIEW_HEADER = 'x-client-preview'

// Drop-in replacement for `fetch()` on any /client/** mutation call site.
// While previewing, a non-GET request never reaches the network at all —
// it's blocked immediately with a synthetic 403 Response the caller's
// existing `if (!res.ok)` handling already knows how to surface. When NOT
// previewing (the normal case, and every GET regardless of preview state)
// this is a plain passthrough to fetch(). The X-Client-Preview header is
// also attached whenever isPreview is true, so app/api routes that call
// blockIfPreview() reject the request server-side too — defense in depth
// against a future call site that bypasses this wrapper.
export async function previewFetch(isPreview: boolean, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (isPreview && method !== 'GET') {
    return new Response(
      JSON.stringify({ error: "You're previewing this client's account — actions are disabled in preview mode." }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
  if (!isPreview) return fetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set(PREVIEW_HEADER, 'true')
  return fetch(input, { ...init, headers })
}
