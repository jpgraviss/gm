import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { testStripeConnection } from '@/lib/stripe'

export const POST = withErrorHandler('integrations/stripe/test POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { secretKey } = await req.json().catch(() => ({ secretKey: undefined })) as { secretKey?: string }
  if (!secretKey?.trim()) {
    return NextResponse.json({ connected: false, error: 'No secret key provided' }, { status: 400 })
  }

  const result = await testStripeConnection(secretKey.trim())
  return NextResponse.json({ connected: result.ok, error: result.error })
})
