import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db
    .from('company_files')
    .select('*')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[company files GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) ?? 'other'
  const notes = (formData.get('notes') as string) ?? ''

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
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
    console.error('[company files upload]', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
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
    console.error('[company files insert]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    console.error('[company files DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: fileId })
}
