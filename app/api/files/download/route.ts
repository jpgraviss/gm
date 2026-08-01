import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requirePortalClient } from '@/lib/portal-auth'
import { CLIENT_FILES_BUCKET as BUCKET, resolveFolder } from '@/lib/file-storage'

// GET /api/files/download?path=...&company=... — generate a fresh signed
// URL for a file. Previously took only `path` with zero ownership check —
// any authenticated caller could mint a download URL for any company's
// file by guessing/enumerating its storage path. `company` lets us reuse
// the same portal-scoping check GET /api/files uses; `path` must actually
// live under that company's own folder.
export const GET = withErrorHandler('files/download GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  const company = searchParams.get('company')

  if (!path || !company) {
    return NextResponse.json({ error: 'path and company are required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  const db = createServiceClient()
  // AUDIT #584 — accept either the company_id-keyed folder (current) or
  // the legacy sanitized-name folder (pre-migration files), same
  // dual-read the list route uses. A single fixed prefix here is exactly
  // the check GET /api/files's old collision bug slipped past.
  const { folder, legacyFolder } = await resolveFolder(db, company)
  if (!path.startsWith(`${folder}/`) && !path.startsWith(`${legacyFolder}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    throw error instanceof Error ? error : new Error('Failed to generate download URL')
  }

  return NextResponse.json({ url: data.signedUrl })
})
