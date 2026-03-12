import { NextResponse } from 'next/server'
import { getQBConfig } from '@/lib/quickbooks'

// GET /api/quickbooks/status
// Returns connection state and sync stats
export async function GET() {
  try {
    const config = await getQBConfig()

    if (!config) {
      return NextResponse.json({ connected: false })
    }

    const tokenExpired = new Date(config.token_expires_at).getTime() < Date.now()

    return NextResponse.json({
      connected:      !tokenExpired,
      realmId:        config.realm_id,
      lastSync:       config.last_sync_at,
      invoicesSynced: config.invoices_synced,
      paymentsSynced: config.payments_synced,
      syncErrors:     config.sync_errors,
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
