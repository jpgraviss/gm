import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('automations/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const body = await req.json()

  const result = validate(body, {
    name:    { type: 'string', maxLength: 200 },
    trigger: { type: 'string', maxLength: 100 },
    actions: { type: 'array' },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.name    !== undefined) update.name     = body.name
  if (body.trigger !== undefined) update.trigger  = body.trigger
  if (body.actions !== undefined) update.actions  = body.actions
  if (body.status  !== undefined) update.status   = body.status
  if (body.runs    !== undefined) update.runs     = body.runs
  if (body.lastRun !== undefined) update.last_run = body.lastRun
  const { data, error } = await db.from('automations').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update automation')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('automations/[id] DELETE', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('automations').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete automation')
  }
  return NextResponse.json({ deleted: id })
})
