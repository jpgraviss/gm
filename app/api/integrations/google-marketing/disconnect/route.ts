import { NextRequest, NextResponse } from 'next/server'
import { disconnectGoogleIntegration, type GoogleMarketingProduct } from '@/lib/google-marketing'
import { requireRole } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { withErrorHandler } from '@/lib/api-handler'

const VALID_PRODUCTS: GoogleMarketingProduct[] = ['search_console', 'analytics', 'ads', 'business_profile']

export const POST = withErrorHandler('integrations/google-marketing/disconnect POST', async (req) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const product = body.product as GoogleMarketingProduct | undefined

  if (!product || !VALID_PRODUCTS.includes(product)) {
    return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
  }

  await disconnectGoogleIntegration(product)
  logAudit({ userName: 'system', action: 'google_marketing_disconnected', module: 'integrations', type: 'warning', metadata: { product } })
  return NextResponse.json({ disconnected: product })
})
