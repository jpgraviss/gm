import { NextResponse } from 'next/server'
import { getQBConfig, getValidAccessToken } from '@/lib/quickbooks'

// GET /api/quickbooks/status
// Returns connection state and sync stats. Attempts token refresh if access token is expired.
export async function GET() {
  try {
    const config = await getQBConfig()

    if (!config) {
      return NextResponse.json({ connected: false })
    }

    // Try to get a valid token (will refresh if expired). This correctly handles
    // the case where the 1-hour access token is stale but the 101-day refresh token is still valid.
    const auth = await getValidAccessToken()

    return NextResponse.json({
      connected:      Boolean(auth),
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
