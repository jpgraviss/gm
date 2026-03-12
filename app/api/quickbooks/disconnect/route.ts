import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getQBConfig, createOAuthClient } from '@/lib/quickbooks'

// POST /api/quickbooks/disconnect
// Revokes tokens and removes QB config
export async function POST() {
  try {
    const config = await getQBConfig()
    if (!config) {
      return NextResponse.json({ success: true })
    }

    // Attempt to revoke token with Intuit (best-effort)
    try {
      const client = createOAuthClient()
      client.setToken({
        token_type:    'bearer',
        access_token:  config.access_token,
        refresh_token: config.refresh_token,
        expires_in:    0,
        x_refresh_token_expires_in: 0,
        realmId:       config.realm_id,
      })
      await client.revoke({ token: config.refresh_token })
    } catch {
      // Ignore revoke errors — still delete config
    }

    const db = createServiceClient()
    await db.from('quickbooks_config').delete().eq('id', config.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Disconnect failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
