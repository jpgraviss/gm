import { createServiceClient } from './supabase'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
  if (!ALLOWED_TYPES.has(file.type)) return `File type "${file.type}" is not supported.`
  return null
}

export async function uploadFile(
  file: File,
  bucket: string,
  path: string,
): Promise<{ url: string; path: string }> {
  const db = createServiceClient()
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600)
  return { url: data?.signedUrl ?? '', path }
}

export async function getFileUrl(bucket: string, path: string): Promise<string> {
  const db = createServiceClient()
  const { data } = await db.storage.from(bucket).createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const db = createServiceClient()
  const { error } = await db.storage.from(bucket).remove([path])
  if (error) throw new Error(error.message)
}
