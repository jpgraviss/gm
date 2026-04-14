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
  LinkedTxn?: { TxnType?: string; TxnId?: string }[]
}

interface QBCustomer {
  Id: string
  DisplayName?: string
  CompanyName?: string
  PrimaryEmailAddr?: { Address?: string }
  PrimaryPhone?: { FreeFormNumber?: string }
  BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string }
  Balance?: number
  Active?: boolean
}

interface QBPayment {
  Id: string
  TxnDate?: string
  TotalAmt?: number
  PaymentMethodRef?: { name?: string }
  CustomerRef?: { name?: string }
  Line?: { LinkedTxn?: { TxnId?: string; TxnType?: string }[] }[]
}

function qbBaseUrl(): string {
  return QB_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

async function qbFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(path, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept:        'application/json',
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`QBO fetch failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

/**
 * Paginated QBO query — QBO limits to 1000 per page. Loops using STARTPOSITION.
 */
async function fetchAllFromQBO<T>(
  entity: 'Invoice' | 'Customer' | 'Payment',
  auth: { accessToken: string; realmId: string },
): Promise<T[]> {
  const results: T[] = []
  let start = 1
  const pageSize = 1000
  while (true) {
    const query = encodeURIComponent(`SELECT * FROM ${entity} STARTPOSITION ${start} MAXRESULTS ${pageSize}`)
    const url = `${qbBaseUrl()}/v3/company/${auth.realmId}/query?query=${query}&minorversion=65`
    const data = await qbFetch<{ QueryResponse?: Record<string, T[]> }>(url, auth.accessToken)
    const rows = data?.QueryResponse?.[entity] ?? []
    results.push(...rows)
    if (rows.length < pageSize) break
    start += pageSize
    // Safety: QB caps at 100k rows — abort if we somehow loop past that
    if (start > 100_000) break
  }
  return results
}

export async function syncCustomersFromQBO(): Promise<{ customersSynced: number; errors: number }> {
  const auth = await getValidAccessToken()
  if (!auth) throw new Error('QuickBooks not connected or token invalid')

  const customers = await fetchAllFromQBO<QBCustomer>('Customer', auth)
  const db = createServiceClient()
  let synced = 0
  let errors = 0

  for (const c of customers) {
    try {
      const companyName = c.CompanyName || c.DisplayName || 'Unknown'
      // Upsert into crm_companies using name as the match key. Only write
      // QB-specific fields so existing CRM data is not overwritten.
      const { data: existing } = await db
        .from('crm_companies')
        .select('id')
        .eq('name', companyName)
        .maybeSingle()

      if (existing?.id) {
        await db.from('crm_companies').update({
          phone:   c.PrimaryPhone?.FreeFormNumber ?? undefined,
        }).eq('id', existing.id)
      } else {
        await db.from('crm_companies').insert({
          id: `co-qb-${c.Id}`,
          name: companyName,
          phone: c.PrimaryPhone?.FreeFormNumber ?? null,
          status: 'Prospect',
          created_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        })
      }
      synced++
    } catch (err) {
      console.error('[qb sync customer]', err)
      errors++
    }
  }

  return { customersSynced: synced, errors }
}

export async function syncPaymentsFromQBO(): Promise<{ paymentsSynced: number; errors: number }> {
  const auth = await getValidAccessToken()
  if (!auth) throw new Error('QuickBooks not connected or token invalid')

  const payments = await fetchAllFromQBO<QBPayment>('Payment', auth)
  const db = createServiceClient()
  let synced = 0
  let errors = 0

  for (const p of payments) {
    try {
      // Each payment can apply to multiple invoices via Line[].LinkedTxn
      const linkedInvoiceIds: string[] = []
      for (const line of (p.Line ?? [])) {
        for (const txn of (line.LinkedTxn ?? [])) {
          if (txn.TxnType === 'Invoice' && txn.TxnId) linkedInvoiceIds.push(txn.TxnId)
        }
      }

      // Update the matched invoices with payment date
      for (const qbInvoiceId of linkedInvoiceIds) {
        await db.from('invoices').update({
          paid_date: p.TxnDate ?? null,
        }).eq('qb_invoice_id', qbInvoiceId)
      }
      synced++
    } catch (err) {
      console.error('[qb sync payment]', err)
      errors++
    }
  }

  return { paymentsSynced: synced, errors }
}

export async function syncInvoicesFromQBO(): Promise<{ invoicesSynced: number; paymentsSynced: number; errors: number }> {
  const auth = await getValidAccessToken()
  if (!auth) throw new Error('QuickBooks not connected or token invalid')

  const qbInvoices = await fetchAllFromQBO<QBInvoice>('Invoice', auth)

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
    } catch (err) {
      console.error('[qb sync invoice]', err)
      errors++
    }
  }

  // Sync linked payment details after invoices are in place
  try {
    await syncPaymentsFromQBO()
  } catch (err) {
    console.error('[qb sync payments step]', err)
    errors++
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

/**
 * Full sync: customers first, then invoices (which triggers payment sync).
 * Safe to call repeatedly — all writes are upserts.
 */
export async function syncAllFromQBO(): Promise<{
  customersSynced: number
  invoicesSynced: number
  paymentsSynced: number
  errors: number
}> {
  const customerResult = await syncCustomersFromQBO()
  const invoiceResult  = await syncInvoicesFromQBO()
  return {
    customersSynced: customerResult.customersSynced,
    invoicesSynced:  invoiceResult.invoicesSynced,
    paymentsSynced:  invoiceResult.paymentsSynced,
    errors:          customerResult.errors + invoiceResult.errors,
  }
}
