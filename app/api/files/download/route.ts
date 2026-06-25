import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const BUCKET = 'client-files'

// GET /api/files/download?path=... — generate a fresh signed URL for a file
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    console.error('[files/download GET]', error)
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
