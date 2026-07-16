import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export const GET = withErrorHandler('chatbots/[id] GET', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied

  const { id } = await params
  const db = createServiceClient()
  const { data, error } = await db.from('chatbots').select('*').eq('id', id).single()
  if (error || !data) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }
  return NextResponse.json(data)
})

export const PATCH = withErrorHandler('chatbots/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const body = await req.json()
  const db = createServiceClient()

  const allowed = ['name', 'website_url', 'welcome_message', 'system_prompt', 'knowledge', 'brand_color', 'avatar_url', 'active', 'settings']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await db.from('chatbots').update(updates).eq('id', id).select().single()
  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('chatbots/[id] DELETE', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const denied = await requireAdmin(req)
  if (denied) return denied
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('chatbots').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json({ success: true })
})
