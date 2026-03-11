import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  TeamMember, Project, Invoice, Contract, Proposal, Deal,
  CRMContact, CRMCompany, CRMActivity, RevenueMonth,
} from './types'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     || 'https://hufztrajgtyuzsgopzyi.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Znp0cmFqZ3R5dXpzZ29wenlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTU4MDgsImV4cCI6MjA4ODgzMTgwOH0.KrCwv92Y6sfvYZlZxl_jWmxzg2H8mSUA3Hyo5NmLBjE'

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Lazy singleton — only created when env vars are present
let _client: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    if (!isConfigured) throw new Error('Supabase env vars not set')
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

// Server-side client using service role key (for API routes only)
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Znp0cmFqZ3R5dXpzZ29wenlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1NTgwOCwiZXhwIjoyMDg4ODMxODA4fQ.Gdd9yfDe4MBsT3js1OJoP8ZghO9g6YAbTsb1NiC2cHM'
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://hufztrajgtyuzsgopzyi.supabase.co'
  return createClient(url, serviceKey)
}

// ── Client-side data fetch helpers ───────────────────────────────────────────
// These call the Next.js API routes and are safe to use in 'use client' components.

async function apiFetch<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(path)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
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
  try {
    const res = await fetch('/api/dashboard')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.revenueByMonth) ? data.revenueByMonth : []
  } catch {
    return []
  }
}
