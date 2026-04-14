import { NextResponse } from 'next/server'
import { listMetaAdAccounts } from '@/lib/meta-ads'

/**
 * GET /api/integrations/meta/accounts
 * Returns the list of Meta ad accounts accessible to the connected user.
 */
export async function GET() {
  try {
    const accounts = await listMetaAdAccounts()
    return NextResponse.json(accounts)
  } catch (err) {
    console.error('[meta/accounts]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch Meta ad accounts' },
      { status: 500 },
    )
  }
}
