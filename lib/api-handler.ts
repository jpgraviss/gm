import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { isNotConfigured } from '@/lib/integration-not-configured'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: NextRequest, ctx?: any) => Promise<NextResponse<any>>

export function withErrorHandler(label: string, handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      // AUDIT #778 — an unconfigured optional integration is a configuration
      // state, not a failure. Answering 500 here meant the message got
      // sanitised away in production (below) and Sentry was paged on every
      // page load, so an operator saw "Internal server error" with no way to
      // tell "not set up" from "broken". The message is safe to return: it
      // names an integration, never internal detail.
      if (isNotConfigured(err)) {
        console.warn(`[${label}] integration not configured: ${err.integration}`)
        return NextResponse.json(
          { error: err.message, notConfigured: true, integration: err.integration },
          { status: 503 },
        )
      }
      const rawMessage = err instanceof Error ? err.message : 'Internal server error'
      console.error(`[${label}]`, err)
      Sentry.captureException(err, {
        tags: { route: label },
        extra: { url: req.url, method: req.method },
      })
      // Thrown messages often include internal detail (DB error text, config
      // variable names) that shouldn't reach an external caller — full detail
      // still goes to logs/Sentry above, client gets a generic message in prod
      const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : rawMessage
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
