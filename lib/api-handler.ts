import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

type Handler = (req: NextRequest) => Promise<NextResponse>

/**
 * Wraps an API route handler with Sentry error capture and structured error responses.
 * Use for any route where unhandled errors should be tracked.
 *
 * Usage:
 *   export const POST = withErrorHandler('deals POST', async (req) => { ... })
 */
export function withErrorHandler(label: string, handler: Handler): Handler {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      console.error(`[${label}]`, err)
      Sentry.captureException(err, {
        tags: { route: label },
        extra: { url: req.url, method: req.method },
      })
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
