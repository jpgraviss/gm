import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { withErrorHandler } from '@/lib/api-handler'
import { requireRole } from '@/lib/rbac'
import { getSettings } from '@/lib/settings'
import { dispatchReviewCampaign, getTemplatePreviews } from '@/lib/review-campaigns'

export const GET = withErrorHandler('reputation/requests GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const db = createServiceClient()
  const { data: campaigns, error } = await db
    .from('review_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Failed to fetch campaigns')
  }

  const settings = await getSettings()
  return NextResponse.json({ campaigns: campaigns ?? [], templates: getTemplatePreviews(settings.company.name) })
})

export const POST = withErrorHandler('reputation/requests POST', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const body = await req.json()
  const { name, template, audience, scheduled_at, workspace_id } = body as {
    name: string
    template: string
    audience: string
    scheduled_at: string | null
    workspace_id?: string
  }

  if (!name || !template || !audience) {
    return NextResponse.json({ error: 'name, template, and audience are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('review_campaigns')
    .insert({
      workspace_id: workspace_id ?? null,
      name,
      template,
      audience,
      sent_count: 0,
      opened_count: 0,
      reviews_count: 0,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create campaign')
  }

  // No schedule set — dispatch right away rather than leaving it as an
  // inert draft with no way to ever send it (there's no separate "Send
  // Now" action in the UI). Best-effort: a dispatch failure still leaves
  // the campaign row behind so it's visible and can be investigated.
  if (!scheduled_at) {
    try {
      const result = await dispatchReviewCampaign(db, data)
      // AUDIT — previously marked 'sent' unconditionally whenever dispatch
      // didn't throw, even if the resolved audience was empty or every
      // send failed (dispatchReviewCampaign catches per-recipient errors
      // internally and just returns counts). The UI showed a green "Sent"
      // badge indistinguishable from "it worked, nobody's responded yet."
      const status = result.sent > 0 ? 'sent' : 'failed'
      const { data: updated } = await db
        .from('review_campaigns')
        .update({ status })
        .eq('id', data.id)
        .select()
        .single()
      return NextResponse.json(updated ?? data, { status: 201 })
    } catch (err) {
      console.error(`[reputation/requests] dispatch failed for campaign ${data.id}:`, err)
      const { data: updated } = await db
        .from('review_campaigns')
        .update({ status: 'failed' })
        .eq('id', data.id)
        .select()
        .single()
      return NextResponse.json(updated ?? data, { status: 201 })
    }
  }

  return NextResponse.json(data, { status: 201 })
})
