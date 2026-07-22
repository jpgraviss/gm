import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requirePortalClient } from '@/lib/portal-auth'

// Mirrors the signed-URL pattern in GET /api/files — proposal-pdfs is a
// private bucket, so the client needs a short-lived signed URL rather than
// a direct storage path.
export const GET = withErrorHandler('proposals/[id]/pdf GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()

  const { data: proposal } = await db.from('proposals').select('company, pdf_path').eq('id', id).maybeSingle()
  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  const denied = await requirePortalClient(req, proposal.company)
  if (denied) return denied

  if (!proposal.pdf_path) {
    return NextResponse.json({ error: 'No PDF has been generated for this proposal' }, { status: 404 })
  }

  const { data: signed, error } = await db.storage.from('proposal-pdfs').createSignedUrl(proposal.pdf_path, 3600)
  if (error || !signed) {
    throw new Error(String(error) || 'Failed to sign proposal PDF URL')
  }

  return NextResponse.json({ url: signed.signedUrl })
})
