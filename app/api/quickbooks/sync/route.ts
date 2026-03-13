import { NextResponse } from 'next/server'
import { syncInvoicesFromQBO, getQBConfig } from '@/lib/quickbooks'

// POST /api/quickbooks/sync
// Pulls invoices and payments from QBO into GravHub
export async function POST() {
  try {
    const config = await getQBConfig()
    if (!config) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
    }

    const result = await syncInvoicesFromQBO()

    return NextResponse.json({
      success:        true,
      invoicesSynced: result.invoicesSynced,
      paymentsSynced: result.paymentsSynced,
      errors:         result.errors,
    })
  } catch (err) {
    console.error('[quickbooks/sync POST]', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
