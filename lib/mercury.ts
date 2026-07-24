const MERCURY_BASE = 'https://api.mercury.com/api/v1'

async function getApiKey(): Promise<string | null> {
  if (process.env.MERCURY_API_KEY) return process.env.MERCURY_API_KEY
  try {
    const { createServiceClient } = await import('@/lib/supabase')
    const { decrypt } = await import('@/lib/encryption')
    const db = createServiceClient()
    const { data } = await db
      .from('app_settings')
      .select('mercury')
      .eq('id', 'global')
      .maybeSingle()
    const apiKey = (data?.mercury as { apiKey?: string })?.apiKey
    return apiKey ? decrypt(apiKey) : null
  } catch {
    return null
  }
}

async function mercuryFetch(path: string) {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('Mercury API key not configured')

  const res = await fetch(`${MERCURY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mercury API error (${res.status}): ${text}`)
  }

  return res.json()
}

export interface MercuryAccount {
  id: string
  name: string
  status: string
  type: string
  currentBalance: number
  availableBalance: number
  accountNumber: string
  routingNumber: string
}

export interface MercuryTransaction {
  id: string
  amount: number
  bankDescription: string
  counterpartyName: string
  counterpartyNickname: string | null
  createdAt: string
  dashboardLink: string
  details: string | null
  estimatedDeliveryDate: string
  externalMemo: string | null
  kind: string
  note: string | null
  postedAt: string | null
  status: string
}

export async function listAccounts(): Promise<MercuryAccount[]> {
  const data = await mercuryFetch('/accounts')
  return data.accounts ?? []
}

export async function getAccount(accountId: string): Promise<MercuryAccount> {
  return mercuryFetch(`/account/${accountId}`)
}

export async function listTransactions(
  accountId: string,
  opts?: { limit?: number; offset?: number; start?: string; end?: string; status?: string; search?: string },
): Promise<{ total: number; transactions: MercuryTransaction[] }> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  if (opts?.start) params.set('start', opts.start)
  if (opts?.end) params.set('end', opts.end)
  if (opts?.status) params.set('status', opts.status)
  if (opts?.search) params.set('search', opts.search)
  const qs = params.toString()
  const data = await mercuryFetch(`/account/${accountId}/transactions${qs ? '?' + qs : ''}`)
  return { total: data.total ?? 0, transactions: data.transactions ?? [] }
}
