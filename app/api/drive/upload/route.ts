import { NextRequest, NextResponse } from 'next/server'
import { getValidDriveToken, uploadFile } from '@/lib/google-drive'

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

// POST /api/drive/upload — upload a file to Google Drive
export async function POST(req: NextRequest) {
  try {
    const token = await getValidDriveToken()
    if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 413 })
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `File type "${file.type}" is not allowed.` }, { status: 415 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFile(file.name, folderId, buffer, file.type || 'application/octet-stream', token)

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[drive/upload POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
