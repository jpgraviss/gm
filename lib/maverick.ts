const BASE = 'https://api-v1.maverickintelligence.co'

function headers() {
  const key = process.env.MAVERICK_API_KEY
  if (!key) throw new Error('MAVERICK_API_KEY not set')
  return { 'X-API-Key': key }
}

export interface MaverickPerson {
  id: string
  email: string
  businessEmail: string | null
  personalEmail: string | null
  firstName: string
  lastName: string
  title: string | null
  company: string | null
  phone: string | null
  profileImageUrl: string | null
  trafficType: string | null
  adPlatform: string | null
  isHotLead: boolean
  visitCount: number
}

export interface MaverickEvent {
  id: string
  eventType: string
  url: string
  timestamp: string
}

export interface MaverickCompany {
  id: string
  name: string
  domain: string | null
  industry: string | null
  size: string | null
  visitorCount: number
}

export interface MaverickStats {
  totalPeople: number
  totalCompanies: number
  recentEvents: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { limit: number; count: number; nextCursor?: string }
}

async function get<T>(path: string, params?: Record<string, string>): Promise<PaginatedResponse<T>> {
  const url = new URL(`${BASE}${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Maverick API ${res.status}: ${body}`)
  }
  return res.json()
}

export async function listPeople(opts?: { limit?: number; cursor?: string; since?: string; hotLeadsOnly?: boolean }) {
  const params: Record<string, string> = {}
  if (opts?.limit) params.limit = String(opts.limit)
  if (opts?.cursor) params.cursor = opts.cursor
  if (opts?.since) params.since = opts.since
  if (opts?.hotLeadsOnly) params.hot_leads_only = 'true'
  return get<MaverickPerson>('/v1/people', params)
}

export async function getPerson(id: string) {
  const res = await fetch(`${BASE}/v1/people/${id}`, { headers: headers() })
  if (!res.ok) throw new Error(`Maverick API ${res.status}`)
  return res.json() as Promise<MaverickPerson>
}

export async function getPersonEvents(id: string, opts?: { limit?: number; cursor?: string }) {
  const params: Record<string, string> = {}
  if (opts?.limit) params.limit = String(opts.limit)
  if (opts?.cursor) params.cursor = opts.cursor
  const url = new URL(`${BASE}/v1/people/${id}/events`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error(`Maverick API ${res.status}`)
  return res.json() as Promise<{
    person: { id: string; firstName: string; lastName: string; email: string; company: string }
    data: MaverickEvent[]
    pagination: { limit: number; count: number; nextCursor?: string }
  }>
}

export async function listCompanies(opts?: { limit?: number; cursor?: string }) {
  const params: Record<string, string> = {}
  if (opts?.limit) params.limit = String(opts.limit)
  if (opts?.cursor) params.cursor = opts.cursor
  return get<MaverickCompany>('/v1/companies', params)
}

export async function getStatistics() {
  const res = await fetch(`${BASE}/v1/stats`, { headers: headers() })
  if (!res.ok) throw new Error(`Maverick API ${res.status}`)
  return res.json() as Promise<{ data: MaverickStats }>
}
