import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { requirePortalClient, blockIfPreview } from '@/lib/portal-auth'
import { CLIENT_FILES_BUCKET as BUCKET, resolveFolder } from '@/lib/file-storage'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'video/mp4',
  'video/quicktime',
])

export const GET = withErrorHandler('files GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  if (!company) {
    return NextResponse.json({ error: 'company is required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  const db = createServiceClient()
  const { folder, legacyFolder } = await resolveFolder(db, company)

  // AUDIT #584 — read from both the company_id-keyed folder (current) and
  // the old sanitized-name folder (pre-migration files, or a company with
  // no crm_companies match) so nothing goes invisible mid-migration. Once
  // the storage migration script has moved everything, the legacy listing
  // is just empty and this is a harmless no-op extra call.
  const folders = folder === legacyFolder ? [folder] : [folder, legacyFolder]
  const listed = await Promise.all(
    folders.map(f => db.storage.from(BUCKET).list(f, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } }))
  )
  const firstError = listed.find(r => r.error)?.error
  if (firstError) {
    throw new Error(String(firstError) || 'Failed to list files')
  }

  // Generate signed URLs for each file
  const files = await Promise.all(
    folders.flatMap((f, i) =>
      (listed[i].data ?? [])
        .filter(entry => entry.name !== '.emptyFolderPlaceholder')
        .map(async entry => {
          const path = `${f}/${entry.name}`
          const { data: urlData } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)
          return {
            name: entry.name,
            size: entry.metadata?.size ?? 0,
            createdAt: entry.created_at,
            url: urlData?.signedUrl ?? null,
            path,
          }
        })
    )
  )

  return NextResponse.json(files)
})

export const POST = withErrorHandler('files POST', async (req: NextRequest) => {
  // AUDIT.md #535 — the client-side isPreview guard on app/client/page.tsx's
  // upload call sites was bypassable via devtools/direct API call using the
  // admin's own preview session, writing a real file into the real client's
  // storage bucket. Internal staff upload tools never set this header, so
  // they're unaffected.
  const blocked = blockIfPreview(req)
  if (blocked) return blocked

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const company = formData.get('company') as string | null

  if (!file || !company) {
    return NextResponse.json({ error: 'file and company are required' }, { status: 400 })
  }

  const denied = await requirePortalClient(req, company)
  if (denied) return denied

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 413 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: `File type "${file.type}" is not allowed.` }, { status: 415 })
  }

  const db = createServiceClient()
  // AUDIT #584 — new uploads always land under the company_id-keyed
  // folder (never the lossy sanitized-name one), so the collision this
  // finding describes can't recur for anything uploaded from here on.
  const { folder } = await resolveFolder(db, company)
  const filePath = `${folder}/${file.name}`

  const { error } = await db.storage.from(BUCKET).upload(filePath, file, {
    upsert: true,
  })

  if (error) {
    throw new Error(String(error) || 'Failed to upload file')
  }

  const { data: urlData } = await db.storage.from(BUCKET).createSignedUrl(filePath, 3600)

  return NextResponse.json({
    name: file.name,
    size: file.size,
    path: filePath,
    url: urlData?.signedUrl ?? null,
  }, { status: 201 })
})

export const DELETE = withErrorHandler('files DELETE', async (req: NextRequest) => {
  // Every real caller of this DELETE (app/projects/page.tsx,
  // app/projects/[id]/page.tsx) is staff-only — no portal page exposes a
  // delete control — so this is a straight role gate rather than
  // per-company scoping. Previously had zero auth at all: unauthenticated
  // arbitrary-path deletion in the client-files bucket.
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { path } = body

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db.storage.from(BUCKET).remove([path])

  if (error) {
    throw new Error(String(error) || 'Failed to delete file')
  }

  return NextResponse.json({ ok: true })
})
