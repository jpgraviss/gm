// ─── Google Drive API helpers (server-side only) ─────────────────────────────

import { encrypt, decrypt } from './encryption'
import { createServiceClient } from './supabase'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API        = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
]

// ── OAuth helpers ────────────────────────────────────────────────────────────

export function getDriveAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/drive/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeDriveCode(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/drive/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

async function refreshDriveToken(refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

// ── Token management ─────────────────────────────────────────────────────────

export interface DriveConfig {
  google_drive_refresh_token: string | null
  google_drive_access_token: string | null
  google_drive_token_expiry: string | null
  google_drive_root_folder: string | null
}

export async function getDriveConfig(): Promise<DriveConfig | null> {
  const db = createServiceClient()
  const { data } = await db.from('app_settings').select('*').eq('id', 'global').single()
  if (!data) return null
  const drive = (data as Record<string, unknown>).google_drive as DriveConfig | undefined
  return drive ?? null
}

export async function saveDriveConfig(config: Partial<DriveConfig>): Promise<void> {
  const db = createServiceClient()
  const { data: existing } = await db.from('app_settings').select('*').eq('id', 'global').single()
  const current = (existing as Record<string, unknown>)?.google_drive ?? {}
  await db.from('app_settings').upsert({
    id: 'global',
    google_drive: { ...current, ...config },
  }, { onConflict: 'id' })
}

export async function getValidDriveToken(): Promise<string | null> {
  const config = await getDriveConfig()
  if (!config?.google_drive_refresh_token) return null

  // Check if current access token is still valid
  if (config.google_drive_access_token && config.google_drive_token_expiry) {
    const expiry = new Date(config.google_drive_token_expiry).getTime()
    if (Date.now() < expiry - 60_000) {
      return decrypt(config.google_drive_access_token)
    }
  }

  // Refresh the token
  const refreshToken = decrypt(config.google_drive_refresh_token)
  const newToken = await refreshDriveToken(refreshToken)
  await saveDriveConfig({
    google_drive_access_token: encrypt(newToken),
    google_drive_token_expiry: new Date(Date.now() + 3500 * 1000).toISOString(),
  })
  return newToken
}

// ── Drive API operations ─────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  iconLink?: string
  createdTime?: string
  modifiedTime?: string
  size?: string
  parents?: string[]
}

export async function listFiles(folderId: string, token: string): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`
  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,iconLink,createdTime,modifiedTime,size,parents)',
    orderBy: 'folder,name',
    pageSize: '100',
  })
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`)
  const data = await res.json()
  return data.files ?? []
}

export async function createFolder(name: string, parentId: string | null, token: string): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) metadata.parents = [parentId]

  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })
  if (!res.ok) throw new Error(`Drive create folder failed: ${res.status}`)
  return res.json()
}

export async function uploadFile(
  name: string,
  folderId: string,
  fileBuffer: Buffer,
  mimeType: string,
  token: string,
): Promise<DriveFile> {
  // Use multipart upload for simplicity
  const metadata = JSON.stringify({
    name,
    parents: [folderId],
  })

  const boundary = 'gravhub_upload_boundary'
  const body = [
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadata,
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
  ].join('')

  const bodyEnd = `\r\n--${boundary}--`
  const bodyBuffer = Buffer.concat([
    Buffer.from(body, 'utf-8'),
    fileBuffer,
    Buffer.from(bodyEnd, 'utf-8'),
  ])

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: bodyBuffer,
  })
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
  return res.json()
}

export async function ensureClientFolder(
  clientName: string,
  token: string,
): Promise<{ rootId: string; clientId: string; subfolders: Record<string, string> }> {
  const config = await getDriveConfig()
  let rootId = config?.google_drive_root_folder ?? null

  // Create GravHub root folder if needed
  if (!rootId) {
    const root = await createFolder('GravHub', null, token)
    rootId = root.id
    await saveDriveConfig({ google_drive_root_folder: rootId })
  }

  // Find or create client folder
  const clientFiles = await listFiles(rootId, token)
  let clientFolder = clientFiles.find(
    f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === clientName
  )
  if (!clientFolder) {
    clientFolder = await createFolder(clientName, rootId, token)
  }

  // Ensure standard subfolders
  const subfolderNames = ['Projects', 'Proposals', 'Contracts', 'Deliverables']
  const existing = await listFiles(clientFolder.id, token)
  const subfolders: Record<string, string> = {}

  for (const name of subfolderNames) {
    const found = existing.find(
      f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === name
    )
    if (found) {
      subfolders[name] = found.id
    } else {
      const created = await createFolder(name, clientFolder.id, token)
      subfolders[name] = created.id
    }
  }

  return { rootId, clientId: clientFolder.id, subfolders }
}
