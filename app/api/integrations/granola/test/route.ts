import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { testGranolaConnection } from '@/lib/granola'

export const POST = withErrorHandler('integrations/granola/test POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { apiKey } = await req.json().catch(() => ({ apiKey: undefined })) as { apiKey?: string }
  if (!apiKey?.trim()) {
    return NextResponse.json({ connected: false, error: 'No API key provided' }, { status: 400 })
  }

  const result = await testGranolaConnection(apiKey.trim())
  return NextResponse.json({ connected: result.ok, error: result.error })
})
