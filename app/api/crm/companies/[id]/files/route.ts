import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
])
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export const GET = withErrorHandler('crm/companies/[id]/files GET', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('company_files')
    .select('*')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(data)
})

export const POST = withErrorHandler('crm/companies/[id]/files POST', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) ?? 'other'
  const notes = (formData.get('notes') as string) ?? ''

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 400 })
  }
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 })
  }

  const db = createServiceClient()

  const ext = file.name.split('.').pop() ?? ''
  const storagePath = `companies/${id}/${Date.now()}-${file.name}`

  const { error: uploadError } = await db.storage
    .from('company-files')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: urlData } = db.storage
    .from('company-files')
    .getPublicUrl(storagePath)

  const { data, error } = await db
    .from('company_files')
    .insert({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      company_id: id,
      name: file.name,
      storage_path: storagePath,
      url: urlData.publicUrl,
      content_type: file.type,
      size_bytes: file.size,
      category,
      notes: notes || null,
      file_ext: ext,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json(data, { status: 201 })
})

export const PATCH = withErrorHandler('crm/companies/[id]/files PATCH', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const { fileId, category } = await req.json()
  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
  }
  if (!category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('company_files')
    .update({ category })
    .eq('id', fileId)
    .eq('company_id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('crm/companies/[id]/files DELETE', async (
  req,
  { params }: { params: Promise<{ id: string }> },
) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied
  const { id } = await params
  const { fileId } = await req.json()
  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: file } = await db
    .from('company_files')
    .select('storage_path')
    .eq('id', fileId)
    .eq('company_id', id)
    .single()

  if (file?.storage_path) {
    await db.storage.from('company-files').remove([file.storage_path])
  }

  const { error } = await db
    .from('company_files')
    .delete()
    .eq('id', fileId)
    .eq('company_id', id)

  if (error) {
    throw new Error(error.message)
  }

  return NextResponse.json({ deleted: fileId })
})
