import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockDb } from '../helpers/mock-db'

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => createMockDb({ deleteResult: { error: null } }),
}))
vi.mock('@/lib/rbac', () => ({
  requireRole: vi.fn().mockResolvedValue(null),
  getAuthUser: vi.fn().mockResolvedValue({ name: 'Jamie Rivera', email: 'jamie@gravissmarketing.com' }),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn() }))

import { DELETE } from '@/app/api/ai/audit/route'
import { logAudit } from '@/lib/audit'

describe('DELETE /api/ai/audit', () => {
  it('deletes an audit by id', async () => {
    const req = new NextRequest(new URL('http://localhost/api/ai/audit?id=audit-1'), { method: 'DELETE' })
    const res = await DELETE(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.deleted).toBe('audit-1')
  })

  // AUDIT #272 — the ~62-site logAudit real-attribution fix (#177) had no
  // regression test asserting the resulting logAudit call's userName; a
  // future refactor could silently reintroduce fake/hardcoded attribution
  // with nothing catching it.
  it('logs the deletion under the real authenticated caller, not a hardcoded name', async () => {
    const req = new NextRequest(new URL('http://localhost/api/ai/audit?id=audit-1'), { method: 'DELETE' })
    await DELETE(req)

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'Jamie Rivera' }),
    )
  })

  it('rejects a request with no id', async () => {
    const req = new NextRequest(new URL('http://localhost/api/ai/audit'), { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
