import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { syncGranolaNotes } from '@/lib/granola'

// Manual "Sync Now" trigger from Settings. The same syncGranolaNotes()
// also runs automatically every cron tick (app/api/cron/route.ts) once
// configured — this route exists so a user doesn't have to wait for the
// next tick to see it work after saving a key.
export const POST = withErrorHandler('integrations/granola/sync POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const result = await syncGranolaNotes()
  if (result.error) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
})
