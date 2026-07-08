import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

const BUCKETS = [
  { name: 'uploads', public: false },
  { name: 'reports', public: false },
  { name: 'avatars', public: true },
  { name: 'deliverables', public: false },
] as const

export const POST = withErrorHandler('storage/setup POST', async (req) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const db = createServiceClient()
  const results: { bucket: string; status: 'created' | 'exists' | 'error'; error?: string }[] = []

  for (const bucket of BUCKETS) {
    const { data: existing } = await db.storage.getBucket(bucket.name)
    if (existing) {
      results.push({ bucket: bucket.name, status: 'exists' })
      continue
    }

    const { error } = await db.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: 10 * 1024 * 1024,
    })

    if (error) {
      results.push({ bucket: bucket.name, status: 'error', error: error.message })
    } else {
      results.push({ bucket: bucket.name, status: 'created' })
    }
  }

  return NextResponse.json({ buckets: results })
})
