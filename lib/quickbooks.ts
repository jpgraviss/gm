import OAuthClient from 'intuit-oauth'
import { createServiceClient } from '@/lib/supabase'

const QB_CLIENT_ID     = process.env.QB_CLIENT_ID     || ''
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET || ''
const QB_REDIRECT_URI  = process.env.QB_REDIRECT_URI  || 'https://app.gravissmarketing.com/api/quickbooks/callback'
const QB_ENVIRONMENT   = (process.env.QB_ENVIRONMENT  || 'sandbox') as 'sandbox' | 'production'

export function isQBConfigured(): boolean {
  return Boolean(QB_CLIENT_ID && QB_CLIENT_SECRET)
}

export function createOAuthClient(): OAuthClient {
  return new OAuthClient({
    clientId:     QB_CLIENT_ID,
    clientSecret: QB_CLIENT_SECRET,
    environment:  QB_ENVIRONMENT,
    redirectUri:  QB_REDIRECT_URI,
  })
}

export function getAuthorizationUrl(state: string): string {
  const client = createOAuthClient()
  return client.authorizeUri({
    scope:    [OAuthClient.scopes.Accounting, OAuthClient.scopes.Payment],
    state,
  })
}

interface QBConfig {
  id: string
  realm_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  last_sync_at: string | null
  invoices_synced: number
  payments_synced: number
  sync_errors: number
}

export async function getQBConfig(): Promise<QBConfig | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('quickbooks_config')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data || null
}

// Returns a valid access token, refreshing if expired
export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string } | null> {
  const config = await getQBConfig()
  if (!config) return null

  const expiry = new Date(config.token_expires_at).getTime()
  const nowMs   = Date.now()

  if (expiry - nowMs > 5 * 60 * 1000) {
    // Token is still valid (>5 min remaining)
    return { accessToken: config.access_token, realmId: config.realm_id }
  }

  // Refresh the token
  try {
    const client = createOAuthClient()
    client.setToken({
      token_type:    'bearer',
      access_token:  config.access_token,
      refresh_token: config.refresh_token,
      expires_in:    0,
      x_refresh_token_expires_in: 8726400,
      realmId:       config.realm_id,
    })
    const authResponse = await client.refresh()
    const token        = authResponse.getToken()

    const db = createServiceClient()
    await db.from('quickbooks_config').update({
      access_token:     token.access_token,
      refresh_token:    token.refresh_token || config.refresh_token,
      token_expires_at: new Date(Date.now() + (token.expires_in as number) * 1000).toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq('id', config.id)

    return { accessToken: token.access_token as string, realmId: config.realm_id }
  } catch {
    return null
  }
}

interface QBInvoice {
  Id: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  TotalAmt?: number
  Balance?: number
  CustomerRef?: { value?: string; name?: string }
  Line?: unknown[]
  EmailStatus?: string
  PrintStatus?: string
  LinkedTxn?: { TxnType?: string }[]
}

export async function syncInvoicesFromQBO(): Promise<{ invoicesSynced: number; paymentsSynced: number; errors: number }> {
  const auth = await getValidAccessToken()
  if (!auth) throw new Error('QuickBooks not connected or token invalid')

  const baseUrl = QB_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'

  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept:        'application/json',
    'Content-Type': 'application/json',
  }

  // Fetch invoices from QBO
  const invoiceRes = await fetch(
    `${baseUrl}/v3/company/${auth.realmId}/query?query=SELECT%20*%20FROM%20Invoice%20MAXRESULTS%20100&minorversion=65`,
    { headers },
  )
  if (!invoiceRes.ok) throw new Error(`QBO invoice fetch failed: ${invoiceRes.status}`)
  const invoiceData = await invoiceRes.json()
  const qbInvoices: QBInvoice[] = invoiceData?.QueryResponse?.Invoice || []

  const db = createServiceClient()
  let invoicesSynced = 0
  let paymentsSynced = 0
  let errors        = 0

  for (const qbInv of qbInvoices) {
    try {
      const isPaid     = (qbInv.Balance ?? 0) === 0 && (qbInv.TotalAmt ?? 0) > 0
      const isPartial  = (qbInv.Balance ?? 0) > 0 && (qbInv.Balance ?? 0) < (qbInv.TotalAmt ?? 0)
      const hasPayment = qbInv.LinkedTxn?.some(t => t.TxnType === 'Payment')

      const status = isPaid ? 'Paid' : isPartial ? 'Sent' : 'Pending'
      if (hasPayment) paymentsSynced++

      const row = {
        qb_invoice_id: qbInv.Id,
        company: qbInv.CustomerRef?.name || 'Unknown',
        client: qbInv.CustomerRef?.name || 'Unknown',
        amount: qbInv.TotalAmt || 0,
        amount_paid: (qbInv.TotalAmt || 0) - (qbInv.Balance || 0),
        status,
        issued_date: qbInv.TxnDate || new Date().toISOString().split('T')[0],
        due_date: qbInv.DueDate || null,
        source: 'quickbooks',
      }

      await db.from('invoices').upsert(row, { onConflict: 'qb_invoice_id', ignoreDuplicates: false })
      invoicesSynced++
    } catch {
      errors++
    }
  }

  // Update config stats
  const config = await getQBConfig()
  if (config) {
    await db.from('quickbooks_config').update({
      last_sync_at:    new Date().toISOString(),
      invoices_synced: invoicesSynced,
      payments_synced: paymentsSynced,
      sync_errors:     errors,
      updated_at:      new Date().toISOString(),
    }).eq('id', config.id)
  }

  return { invoicesSynced, paymentsSynced, errors }
}
