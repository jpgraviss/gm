import { NextRequest, NextResponse } from 'next/server'
import {
  getValidDriveToken, getDriveConfig, getDriveAuthUrl,
  listFiles, createFolder, ensureClientFolder,
  downloadFile, shareFile, shareFilePublic, deleteFile,
} from '@/lib/google-drive'
import { withErrorHandler } from '@/lib/api-handler'
import { issueOAuthState } from '@/lib/oauth-state'
import { requireRole } from '@/lib/rbac'
import { getAuthenticatedEmail } from '@/lib/admin-auth'

// GET /api/drive?action=status|list|auth-url|client-folder|download
// Previously had zero auth on any action or method — any caller could
// list/download/create/share/delete anything the shared Drive OAuth token
// can reach. Drive has no per-file company-ownership record to check
// against (files aren't tracked against a company_id anywhere), so this
// can't scope `download` to "the caller's own company's files" the way
// requirePortalClient does elsewhere — it requires any real authenticated
// identity, staff or portal client. The management actions (list,
// client-folder, create-folder, share, delete) have no current portal
// caller and stay staff-only.
export const GET = withErrorHandler('drive GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'status'

  if (action === 'auth-url' || action === 'status' || action === 'list' || action === 'client-folder') {
    const denied = await requireRole(req, 'Team Member')
    if (denied) return denied
  } else {
    const email = await getAuthenticatedEmail(req)
    if (!email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
  }

  if (action === 'auth-url') {
    const { state, setCookie } = issueOAuthState('drive')
    return setCookie(NextResponse.json({ url: getDriveAuthUrl(state) }))
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
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      },
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
})

// POST /api/drive — create folder or share file (staff-only; no portal caller)
export const POST = withErrorHandler('drive POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

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
})

// DELETE /api/drive?fileId=... (staff-only, destructive; no portal caller)
export const DELETE = withErrorHandler('drive DELETE', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Leadership')
  if (denied) return denied

  const token = await getValidDriveToken()
  if (!token) return NextResponse.json({ error: 'Google Drive not connected' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 })

  await deleteFile(fileId, token)
  return NextResponse.json({ success: true })
})
