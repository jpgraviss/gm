import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validate, validationError, EMAIL_PATTERN } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

export const PATCH = withErrorHandler('portal-clients/[id] PATCH', async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return validationError('Invalid JSON body')
  }

  const result = validate(body, {
    company: { type: 'string', maxLength: 200 },
    email:   { type: 'string', pattern: EMAIL_PATTERN },
    contact: { type: 'string', maxLength: 200 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const update: Record<string, unknown> = {}
  if (body.company      !== undefined) update.company       = body.company
  if (body.service      !== undefined) update.service       = body.service
  if (body.access       !== undefined) update.access        = body.access
  if (body.lastLogin    !== undefined) update.last_login    = body.lastLogin
  if (body.contact      !== undefined) update.contact       = body.contact
  if (body.email        !== undefined) update.email         = body.email
  if (body.portalRole   !== undefined) update.portal_role   = body.portalRole
  if (body.portalConfig !== undefined) {
    if (body.mergePortalConfig === true) {
      const existing = await db.from('portal_clients').select('portal_config').eq('id', id).single()
      const existingConfig = (existing.data?.portal_config as Record<string, unknown>) ?? {}
      update.portal_config = { ...existingConfig, ...(body.portalConfig as Record<string, unknown>) }
    } else {
      update.portal_config = body.portalConfig
    }
  }
  if (body.services     !== undefined) update.services      = body.services
  if (body.companyId    !== undefined) update.company_id    = body.companyId
  const { data, error } = await db.from('portal_clients').update(update).eq('id', id).select().single()
  if (error) {
    throw new Error(error?.message || 'Failed to update portal client')
  }
  return NextResponse.json(data)
})

export const DELETE = withErrorHandler('portal-clients/[id] DELETE', async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('portal_clients').delete().eq('id', id)
  if (error) {
    throw new Error(error?.message || 'Failed to delete portal client')
  }
  return NextResponse.json({ deleted: id })
})
