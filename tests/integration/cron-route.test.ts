import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

// GET /api/cron is the highest-blast-radius file in the app: 19 chained jobs
// (sequence execution, uptime alerting, rank tracking, recurring billing,
// scheduled broadcasts, review campaigns, recurring task spawning, stuck-row
// rescue, ...) fire on every tick of the every-5-minute Cron Ping workflow,
// each wrapped in its own try/catch that only console.error()s.
//
// That design is deliberate and correct — one broken job must not take the
// other 18 down with it — but nothing verified it. A refactor that hoisted a
// throw out of a try block, or replaced the per-job catches with one outer
// catch, would silently turn "one job degraded" into "no scheduled work runs
// at all", and the only symptom in production would be an absence: emails not
// sent, invoices not generated, downtime not alerted on.
//
// These tests pin the three properties that actually matter:
//   1. CRON_SECRET authorization is enforced.
//   2. Job isolation — a throwing job does not prevent the others from
//      running, and the request does not 500.
//   3. The response body reports per-job status, so a failure is visible.

const SECRET = 'test-cron-secret'

/** Job names in the order the route runs them, keyed by response field. */
const ALL_JOB_KEYS = [
  'sequences',
  'sequenceReplies',
  'pendingSteps',
  'timeTriggers',
  'calendarSync',
  'recurringTasks',
  'emailToTicket',
  'uptime',
  'socialPosts',
  'rankTracker',
  'recurringBilling',
  'rescuedScheduledEmails',
  'scheduledEmails',
  'seoReports',
  'granola',
  'reviewCampaigns',
  'rankTrackerReports',
  'broadcasts',
  'rescuedAudits',
] as const

let ran: string[]
let failingJobs: Set<string>
let failingFetchUrls: string[]
let dbResults: Record<string, { data?: unknown; error?: unknown; count?: number }>
let serviceClientThrows: boolean

/**
 * Builds a mocked library job. The returned closure reads `ran`/`failingJobs`
 * at CALL time, not at vi.mock-factory time — the factories are hoisted above
 * the `let` declarations above, so anything they touch eagerly would be in TDZ.
 */
function job<T>(name: string, value: T) {
  return (): Promise<T> => {
    ran.push(name)
    if (failingJobs.has(name)) return Promise.reject(new Error(`${name} exploded`))
    return Promise.resolve(value)
  }
}

// ── Supabase ────────────────────────────────────────────────────────────────
// Chainable/thenable stub in the same shape as tests/helpers/mock-db.ts, but
// with per-table results so an individual job's query can be made to fail.

function makeChain(table: string) {
  const result = () => ({ data: [], error: null, count: 0, ...(dbResults[table] ?? {}) })
  const chain: Record<string, unknown> = {}
  for (const method of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'is', 'not', 'or', 'lt', 'lte', 'gt', 'gte',
    'limit', 'order', 'ilike', 'range',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(result()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(result()))
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result()).then(resolve, reject)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(() => {
    if (serviceClientThrows) throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars are required')
    ran.push('createServiceClient')
    return { from: vi.fn((table: string) => makeChain(table)) }
  }),
}))

// ── Library jobs (mocked at the module boundary, as the other integration
//    tests in this directory do). generateRecurringInvoices has its own suite
//    (lib/recurring-billing.ts) — it is mocked here, never re-tested. ───────

vi.mock('@/lib/recurring-billing', () => ({
  generateRecurringInvoices: vi.fn(job('generateRecurringInvoices', { created: 0, skipped: 0 })),
}))

vi.mock('@/lib/email-scheduler', () => ({
  processScheduledEmails: vi.fn(job('processScheduledEmails', { sent: 0, failed: 0 })),
  rescueStuckSendingEmails: vi.fn(job('rescueStuckSendingEmails', { rescued: 0 })),
}))

// NOTE: these factories replace the module wholesale, so every export the
// route imports must be listed here. Adding a new import to route.ts without
// adding it here surfaces as that job reporting { error: 'Failed' } (the
// undefined function throws inside its own try/catch) rather than as a module
// resolution error — if a job unexpectedly starts failing, check this first.
vi.mock('@/lib/rank-tracker', () => ({
  checkAllRanks: vi.fn(job('checkAllRanks', { checked: 0 })),
  checkCompetitorRanks: vi.fn(job('checkCompetitorRanks', { checked: 0 })),
  sendDueScheduledReports: vi.fn(job('sendDueScheduledReports', { sent: 0 })),
}))

vi.mock('@/lib/seo-report-sender', () => ({
  seoReportsDue: vi.fn(job('seoReportsDue', false)),
  sendMonthlyClientReports: vi.fn(job('sendMonthlyClientReports', { sent: 0 })),
}))

vi.mock('@/lib/granola', () => ({
  isGranolaConfigured: vi.fn(job('isGranolaConfigured', false)),
  syncGranolaNotes: vi.fn(job('syncGranolaNotes', { synced: 0 })),
}))

vi.mock('@/lib/uptime', () => ({
  checkSite: vi.fn(job('checkSite', { up: true, statusCode: 200, responseMs: 10 })),
  recordCheck: vi.fn(job('recordCheck', undefined)),
  computeUptime30d: vi.fn(job('computeUptime30d', 100)),
}))

vi.mock('@/lib/social-publish', () => ({
  publishSocialPost: vi.fn(job('publishSocialPost', { anySucceeded: true })),
}))

vi.mock('@/lib/review-campaigns', () => ({
  dispatchReviewCampaign: vi.fn(job('dispatchReviewCampaign', { sent: 0, failed: 0 })),
}))

vi.mock('@/lib/broadcasts', () => ({
  sendBroadcastNow: vi.fn(job('sendBroadcastNow', { sent: 0, total: 0 })),
}))

vi.mock('@/lib/automations-engine', () => ({
  fireAutomations: vi.fn(() => { ran.push('fireAutomations') }),
  executeWorkflow: vi.fn(job('executeWorkflow', undefined)),
}))

import { GET } from '@/app/api/cron/route'

// ── Helpers ─────────────────────────────────────────────────────────────────

function callCron(headers?: Record<string, string>) {
  return GET(new NextRequest(new URL('http://localhost/api/cron'), { headers }))
}

const authorized = () => callCron({ authorization: `Bearer ${SECRET}` })

/** Response keys whose job reported a failure. */
function erroredJobs(json: Record<string, unknown>): string[] {
  return ALL_JOB_KEYS.filter(k => {
    const v = json[k]
    return typeof v === 'object' && v !== null && (v as { error?: unknown }).error !== undefined
  })
}

const originalFetch = global.fetch
const originalCronSecret = process.env.CRON_SECRET
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterAll(() => {
  global.fetch = originalFetch
  process.env.CRON_SECRET = originalCronSecret
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

beforeEach(() => {
  vi.clearAllMocks()
  ran = []
  failingJobs = new Set()
  failingFetchUrls = []
  dbResults = {}
  serviceClientThrows = false
  process.env.CRON_SECRET = SECRET
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    ran.push(`fetch:${url}`)
    if (failingFetchUrls.some(u => url.includes(u))) {
      return Promise.reject(new Error('network unreachable'))
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, from: url }),
    } as unknown as Response)
  }) as unknown as typeof global.fetch
})

// ── 1. Authorization ────────────────────────────────────────────────────────

describe('GET /api/cron — CRON_SECRET authorization', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await callCron()

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('rejects a wrong secret', async () => {
    const res = await callCron({ authorization: 'Bearer not-the-secret' })

    expect(res.status).toBe(401)
  })

  it('rejects a bare secret without the Bearer scheme', async () => {
    const res = await callCron({ authorization: SECRET })

    expect(res.status).toBe(401)
  })

  it('rejects every caller when CRON_SECRET is unset, rather than failing open', async () => {
    delete process.env.CRON_SECRET

    const res = await callCron({ authorization: 'Bearer ' })

    expect(res.status).toBe(401)
  })

  it('runs no job at all for an unauthorized caller', async () => {
    await callCron({ authorization: 'Bearer wrong' })

    expect(ran).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('accepts the correct Bearer secret', async () => {
    const res = await authorized()

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('forwards the cron secret to the sub-routes it calls', async () => {
    await authorized()

    const calls = vi.mocked(global.fetch).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [, init] of calls) {
      expect((init as RequestInit & { headers: Record<string, string> }).headers.Authorization)
        .toBe(`Bearer ${SECRET}`)
    }
  })
})

// ── 2. Per-job status reporting ─────────────────────────────────────────────

describe('GET /api/cron — per-job status reporting', () => {
  it('reports a status for every one of the 19 jobs', async () => {
    const json = await (await authorized()).json()

    for (const key of ALL_JOB_KEYS) {
      expect(json, `missing per-job status for "${key}"`).toHaveProperty(key)
    }
    expect(json.ok).toBe(true)
    expect(typeof json.timestamp).toBe('string')
  })

  it('reports no failures on a clean run', async () => {
    const json = await (await authorized()).json()

    expect(erroredJobs(json)).toEqual([])
  })

  it('reports jobs that legitimately skipped as skipped, not as errors', async () => {
    // seoReportsDue and isGranolaConfigured both resolve false by default.
    const json = await (await authorized()).json()

    expect(json.seoReports).toEqual({ skipped: true })
    expect(json.granola).toEqual({ skipped: true })
    expect(json.rankTracker).toEqual({ skipped: true })
  })

  it('runs the gated job when its due-check passes', async () => {
    dbResults.tracked_keywords = { count: 3 }

    const json = await (await authorized()).json()

    expect(ran).toContain('checkAllRanks')
    expect(json.rankTracker).not.toHaveProperty('error')
  })
})

// ── 3. Job isolation — the property that matters most ───────────────────────

describe('GET /api/cron — job isolation', () => {
  it('does not 500 when a job throws — it reports that job and returns 200', async () => {
    failingJobs.add('processScheduledEmails')

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.scheduledEmails).toEqual({ error: 'Failed' })
  })

  it('still runs every LATER job after an earlier one throws', async () => {
    // processScheduledEmails is job 13 of 19.
    failingJobs.add('processScheduledEmails')

    const json = await (await authorized()).json()

    // Jobs 14-19 all still executed and reported non-error status.
    expect(ran).toContain('seoReportsDue')
    expect(ran).toContain('isGranolaConfigured')
    expect(ran).toContain('sendDueScheduledReports')
    for (const key of ['seoReports', 'granola', 'reviewCampaigns', 'rankTrackerReports', 'broadcasts', 'rescuedAudits']) {
      expect(json[key], `job "${key}" should have run after the failure`).not.toHaveProperty('error')
    }
    expect(erroredJobs(json)).toEqual(['scheduledEmails'])
  })

  it('isolates a competitor-rank failure from the keyword-rank result', async () => {
    // Regression: checkCompetitorRanks was originally added INSIDE
    // checkAllRanks's try block, so a competitor-lookup failure (a billable
    // third-party SERP call — the most likely thing here to fail) also
    // wiped out the keyword-rank result. They are separate jobs and must
    // fail separately, like every other job in this route.
    dbResults.tracked_keywords = { count: 3 } // make the rank check due
    failingJobs.add('checkCompetitorRanks')

    const json = await (await authorized()).json()

    expect(json.competitorRanks).toEqual({ error: 'Failed' })
    expect(json.rankTracker).not.toHaveProperty('error')
  })

  it('isolates a keyword-rank failure from the competitor-rank result', async () => {
    dbResults.tracked_keywords = { count: 3 } // make the rank check due
    failingJobs.add('checkAllRanks')

    const json = await (await authorized()).json()

    expect(json.rankTracker).toEqual({ error: 'Failed' })
    expect(json.competitorRanks).not.toHaveProperty('error')
  })

  it('isolates a recurring-billing failure from the rest of the tick', async () => {
    // generateRecurringInvoices touches real money and runs mid-chain; a throw
    // there must not stop scheduled email/broadcast delivery.
    failingJobs.add('generateRecurringInvoices')

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.recurringBilling).toEqual({ error: 'Failed' })
    expect(erroredJobs(json)).toEqual(['recurringBilling'])
    expect(ran).toContain('rescueStuckSendingEmails')
    expect(ran).toContain('processScheduledEmails')
  })

  it('isolates a failing sub-route fetch from the other three fetch-backed jobs', async () => {
    failingFetchUrls = ['/api/sequences/execute']

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.sequences).toEqual({ error: 'Failed' })
    expect(erroredJobs(json)).toEqual(['sequences'])
    expect(ran.some(r => r.includes('/api/sequences/reply-check'))).toBe(true)
    expect(ran.some(r => r.includes('/api/calendar/sync'))).toBe(true)
    expect(ran.some(r => r.includes('/api/tickets/from-email'))).toBe(true)
  })

  it('isolates a failing database query inside one job', async () => {
    // rescueStuckAudits re-throws on a query error; nothing else touches audits.
    dbResults.audits = { error: { message: 'permission denied for table audits' } }

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.rescuedAudits).toEqual({ error: 'Failed' })
    expect(erroredJobs(json)).toEqual(['rescuedAudits'])
  })

  it('isolates several simultaneous failures from each other', async () => {
    failingJobs.add('generateRecurringInvoices')
    failingJobs.add('sendDueScheduledReports')
    failingFetchUrls = ['/api/calendar/sync']
    dbResults.audits = { error: { message: 'boom' } }

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(erroredJobs(json).sort()).toEqual(
      ['calendarSync', 'rankTrackerReports', 'recurringBilling', 'rescuedAudits'].sort(),
    )
    // Everything else still ran.
    expect(ran).toContain('processScheduledEmails')
    expect(ran).toContain('rescueStuckSendingEmails')
  })

  it('survives a total database outage — the non-database jobs still run', async () => {
    // createServiceClient() throwing is what a missing/rotated service-role key
    // looks like at runtime. Every DB-backed job must report its own failure
    // instead of one of them escaping to the outer handler.
    serviceClientThrows = true

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    for (const key of ['pendingSteps', 'timeTriggers', 'recurringTasks', 'uptime', 'socialPosts', 'rankTracker', 'reviewCampaigns', 'broadcasts', 'rescuedAudits']) {
      expect(json[key], `DB-backed job "${key}" should report its own failure`).toEqual({ error: 'Failed' })
    }
    // The four sub-route fetches and the library-level jobs are unaffected.
    expect(json.sequences).not.toHaveProperty('error')
    expect(json.emailToTicket).not.toHaveProperty('error')
    expect(json.recurringBilling).not.toHaveProperty('error')
    expect(json.scheduledEmails).not.toHaveProperty('error')
  })

  it('never 500s even when every single job fails', async () => {
    serviceClientThrows = true
    failingFetchUrls = ['http://localhost:3000']
    for (const name of [
      'generateRecurringInvoices', 'processScheduledEmails', 'rescueStuckSendingEmails',
      'checkAllRanks', 'sendDueScheduledReports', 'seoReportsDue', 'isGranolaConfigured',
    ]) failingJobs.add(name)

    const res = await authorized()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    // Every job reported its own failure; none escaped to withErrorHandler.
    expect(erroredJobs(json).sort()).toEqual([...ALL_JOB_KEYS].sort())
    expect(json).toHaveProperty('timestamp')
  })
})
