import { NextResponse } from 'next/server'
import { getQBConfig } from '@/lib/quickbooks'

// GET /api/quickbooks/status
// Returns connection state and sync stats. Connected = config row exists.
export async function GET() {
  try {
    const config = await getQBConfig()

    if (!config) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected:      true,
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
