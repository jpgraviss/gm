import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireRole } from '@/lib/rbac'
import { requireAdmin } from '@/lib/admin-auth'
import { validate, validationError } from '@/lib/validation'
import { withErrorHandler } from '@/lib/api-handler'

// Roadmap A7 — document_templates already existed and was already read by
// two backend tools (ai/chat's generate_document/list_templates,
// automations-engine's Apply Service Template) but had no CRUD UI
// anywhere; the only way to add/edit a template was a manual SQL insert
// (see supabase/optional-document-templates.sql).

const TEMPLATE_TYPES = ['proposal', 'contract', 'addendum']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplate(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    type:      row.type,
    body:      row.body,
    version:   row.version,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const GET = withErrorHandler('document-templates GET', async (req: NextRequest) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const db = createServiceClient()
  let query = db.from('document_templates').select('*').order('type').order('name')
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json((data ?? []).map(mapTemplate))
})

export const POST = withErrorHandler('document-templates POST', async (req: NextRequest) => {
  // AUDIT #241 — org-wide legal document templates (proposals/contracts/
  // addendums, resolved by the AI generate_document tool and Apply Service
  // Template automation action) should be admin-only to create, matching
  // this page living under /admin/* and the Permissions reference table.
  const denied = await requireAdmin(req)
  if (denied) return denied

  const body = await req.json()
  const result = validate(body, {
    name: { required: true, type: 'string', maxLength: 200 },
    type: { required: true, type: 'string', enum: TEMPLATE_TYPES },
    body: { required: true, type: 'string', maxLength: 50_000 },
  })
  if (!result.valid) return validationError(result.error)

  const db = createServiceClient()
  const isDefault = body.isDefault === true

  // At most one default per type — the AI generate_document tool and
  // Apply Service Template both resolve "the" default for a type, so two
  // defaults would make that resolution arbitrary/order-dependent.
  if (isDefault) {
    await db.from('document_templates').update({ is_default: false }).eq('type', body.type)
  }

  const { data, error } = await db
    .from('document_templates')
    .insert({
      id:         `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:       body.name,
      type:       body.type,
      body:       body.body,
      version:    1,
      is_default: isDefault,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }
  return NextResponse.json(mapTemplate(data), { status: 201 })
})
