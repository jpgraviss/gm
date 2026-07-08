import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx?: any) => Promise<NextResponse<any>>

export function withErrorHandler(label: string, handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
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
