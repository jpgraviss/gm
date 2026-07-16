import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requirePortalClient } from '@/lib/portal-auth'

const BUCKET = 'client-files'

function sanitizePath(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')
}

// GET /api/files/download?path=...&company=... — generate a fresh signed
// URL for a file. Previously took only `path` with zero ownership check —
// any authenticated caller could mint a download URL for any company's
// file by guessing/enumerating its storage path. `company` lets us reuse
// the same portal-scoping check GET /api/files uses; `path` must actually
// live under that company's sanitized folder.
export const GET = withErrorHandler('files/download GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  const company = searchParams.get('company')

  if (!path || !company) {
    return NextResponse.json({ error: 'path and company are required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  if (!path.startsWith(`${sanitizePath(company)}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServiceClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    throw error instanceof Error ? error : new Error('Failed to generate download URL')
  }

  return NextResponse.json({ url: data.signedUrl })
})
