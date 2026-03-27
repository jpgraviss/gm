import { NextRequest, NextResponse } from 'next/server'
import {
  getValidDriveToken, getDriveConfig, getDriveAuthUrl,
  listFiles, createFolder, ensureClientFolder,
  downloadFile, shareFile, shareFilePublic, deleteFile,
} from '@/lib/google-drive'

// GET /api/drive?action=status|list|auth-url|client-folder
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'status'

  try {
    if (action === 'auth-url') {
      const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url')
      return NextResponse.json({ url: getDriveAuthUrl(state) })
    }

    if (action === 'status') {
      const config = await getDriveConfig()
      const connected = !!config?.google_drive_refresh_token
      return NextResponse.json({
        connected,
        rootFolder: config?.google_drive_root_folder ?? null,
      })
    }

    const token = await getValidDriveToken()
    if (!token) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 401 })
    }

    if (action === 'list') {
      const folderId = searchParams.get('folderId')
      if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 })
      const files = await listFiles(folderId, token)
      return NextResponse.json(files)
    }

    if (action === 'client-folder') {
      const clientName = searchParams.get('client')
      if (!clientName) return NextResponse.json({ error: 'client name required' }, { status: 400 })
      const result = await ensureClientFolder(clientName, token)
      return NextResponse.json(result)
    }

    if (action === 'download') {
      const fileId = searchParams.get('fileId')
      if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })
      const { buffer, name, mimeType } = await downloadFile(fileId, token)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        },
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[drive GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Drive operation failed' },
      { status: 500 },
    )
  }
}

// POST /api/drive — create folder or share file
export async function POST(req: NextRequest) {
  try {
    const token = await getValidDriveToken()
    if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 401 })

    const body = await req.json()
    const action = body.action ?? 'create-folder'

    if (action === 'share') {
      const { fileId, email, role } = body
      if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

      if (email) {
        await shareFile(fileId, email, role ?? 'reader', token)
        return NextResponse.json({ success: true })
      } else {
        const link = await shareFilePublic(fileId, token)
        return NextResponse.json({ success: true, link })
      }
    }

    // Default: create folder
    const { name, parentId } = body
    if (!name) return NextResponse.json({ error: 'Folder name required' }, { status: 400 })

    const folder = await createFolder(name, parentId ?? null, token)
    return NextResponse.json(folder, { status: 201 })
  } catch (err) {
    console.error('[drive POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    )
  }
}

// DELETE /api/drive?fileId=...
export async function DELETE(req: NextRequest) {
  try {
    const token = await getValidDriveToken()
    if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

    await deleteFile(fileId, token)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[drive DELETE]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete file' },
      { status: 500 },
    )
  }
}
