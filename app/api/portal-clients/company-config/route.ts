import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest) {
  try {
    const { company, portalConfig } = await req.json()
    if (!company || typeof company !== 'string') {
      return NextResponse.json({ error: 'company is required' }, { status: 400 })
    }
    if (!portalConfig || typeof portalConfig !== 'object') {
      return NextResponse.json({ error: 'portalConfig is required' }, { status: 400 })
    }

    const db = createServiceClient()

    const { error } = await db
      .from('portal_clients')
      .update({ portal_config: portalConfig })
      .eq('company', company)

    if (error) {
      console.error('[company-config PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    logAudit({ userName: 'admin', action: 'portal_config_updated', module: 'portal', type: 'action', metadata: { company } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[company-config PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
