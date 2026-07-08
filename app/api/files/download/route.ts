import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'

const BUCKET = 'client-files'

// GET /api/files/download?path=... — generate a fresh signed URL for a file
export const GET = withErrorHandler('files/download GET', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    throw error instanceof Error ? error : new Error('Failed to generate download URL')
  }

  return NextResponse.json({ url: data.signedUrl })
})
