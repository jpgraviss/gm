import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/rbac'
import { withErrorHandler } from '@/lib/api-handler'
import { generateAutomation } from '@/lib/automation-generator'

export const maxDuration = 45

export const POST = withErrorHandler('automations/generate POST', async (req) => {
  const denied = await requireRole(req, 'Team Member')
  if (denied) return denied

  const { description } = await req.json()
  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const result = await generateAutomation(description.trim())
  if (!result.automation) {
    return NextResponse.json({ error: result.error ?? 'Generation failed' }, { status: 502 })
  }

  return NextResponse.json({ automation: result.automation, source: result.source })
})
