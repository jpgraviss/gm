import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  TeamMember, Project, Invoice, Contract, Proposal, Deal,
  CRMContact, CRMCompany, CRMActivity, RevenueMonth,
} from './types'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Lazy singleton — throws a clear error if env vars are missing.
let _client: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.'
      )
    }
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

// Server-side client using service role key (for API routes only)
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars are required')
  return createClient(url, serviceKey)
}

// ── Client-side data fetch helpers ───────────────────────────────────────────
// These call the Next.js API routes and are safe to use in 'use client' components.

const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000 // 1s, 2s, 4s exponential backoff

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function apiFetch<T>(path: string): Promise<T[]> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(path)
      if (!res.ok) {
        if (attempt < MAX_RETRIES && isRetryable(res.status)) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }
        return []
      }
      const data = await res.json()
      return Array.isArray(data) ? data : []
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
        continue
      }
    }
  }
  if (lastError) console.error(`apiFetch ${path} failed after ${MAX_RETRIES + 1} attempts:`, lastError)
  return []
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  return apiFetch<TeamMember>('/api/team-members')
}

export async function fetchProjects(): Promise<Project[]> {
  return apiFetch<Project>('/api/projects')
}

export async function fetchInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice>('/api/invoices')
}

export async function fetchContracts(): Promise<Contract[]> {
  return apiFetch<Contract>('/api/contracts')
}

export async function fetchProposals(): Promise<Proposal[]> {
  return apiFetch<Proposal>('/api/proposals')
}

export async function fetchDeals(): Promise<Deal[]> {
  return apiFetch<Deal>('/api/deals')
}

export async function fetchCrmContacts(): Promise<CRMContact[]> {
  return apiFetch<CRMContact>('/api/crm/contacts')
}

export async function fetchCrmCompanies(): Promise<CRMCompany[]> {
  return apiFetch<CRMCompany>('/api/crm/companies')
}

export async function fetchCrmActivities(): Promise<CRMActivity[]> {
  return apiFetch<CRMActivity>('/api/crm/activities')
}

export async function fetchRevenueByMonth(): Promise<RevenueMonth[]> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) {
        if (attempt < MAX_RETRIES && isRetryable(res.status)) {
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
          continue
        }
        return []
      }
      const data = await res.json()
      return Array.isArray(data?.revenueByMonth) ? data.revenueByMonth : []
    } catch (err) {
      lastError = err
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)))
        continue
      }
    }
  }
  if (lastError) console.error(`fetchRevenueByMonth failed after ${MAX_RETRIES + 1} attempts:`, lastError)
  return []
}
