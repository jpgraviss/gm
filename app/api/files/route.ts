import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const BUCKET = 'client-files'
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const company = searchParams.get('company')

  if (!company) {
    return NextResponse.json({ error: 'company is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const folder = sanitizePath(company)

  const { data, error } = await db.storage.from(BUCKET).list(folder, {
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) {
    console.error('[files GET]', error)
    return NextResponse.json({ error: error?.message || 'Failed to list files' }, { status: 500 })
  }

  // Generate signed URLs for each file
  const files = await Promise.all(
    (data ?? [])
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(async f => {
        const path = `${folder}/${f.name}`
        const { data: urlData } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)
        return {
          name: f.name,
          size: f.metadata?.size ?? 0,
          createdAt: f.created_at,
          url: urlData?.signedUrl ?? null,
          path,
        }
      })
  )

  return NextResponse.json(files)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const company = formData.get('company') as string | null

  if (!file || !company) {
    return NextResponse.json({ error: 'file and company are required' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 413 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: `File type "${file.type}" is not allowed.` }, { status: 415 })
  }

  const db = createServiceClient()
  const folder = sanitizePath(company)
  const filePath = `${folder}/${file.name}`

  const { error } = await db.storage.from(BUCKET).upload(filePath, file, {
    upsert: true,
  })

  if (error) {
    console.error('[files POST]', error)
    return NextResponse.json({ error: error?.message || 'Failed to upload file' }, { status: 500 })
  }

  const { data: urlData } = await db.storage.from(BUCKET).createSignedUrl(filePath, 3600)

  return NextResponse.json({
    name: file.name,
    size: file.size,
    path: filePath,
    url: urlData?.signedUrl ?? null,
  }, { status: 201 })
}

function sanitizePath(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')
}
