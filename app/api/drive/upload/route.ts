import { NextRequest, NextResponse } from 'next/server'
import { getValidDriveToken, uploadFile } from '@/lib/google-drive'

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
