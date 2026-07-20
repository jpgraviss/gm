import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({ deleteResult: { error: null } }),
}))
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn().mockResolvedValue(null), getAuthUser: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { DELETE } from '@/app/api/ai/audit/route'

describe('DELETE /api/ai/audit', () => {
  it('deletes an audit by id', async () => {
    const req = new NextRequest(new URL('http://localhost/api/ai/audit?id=audit-1'), { method: 'DELETE' })
    const res = await DELETE(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.deleted).toBe('audit-1')
  })

  it('rejects a request with no id', async () => {
    const req = new NextRequest(new URL('http://localhost/api/ai/audit'), { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
