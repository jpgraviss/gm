/**
 * Structured logger. Writes JSON lines to stdout so Vercel/Datadog can parse
 * them. Falls back to a no-op in tests and a simple console wrapper locally.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ workspace_id, route: '/api/deals', duration_ms: 42 }, 'api.request')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogFields = Record<string, unknown>

function emit(level: LogLevel, fields: LogFields, message?: string) {
  if (process.env.NODE_ENV === 'test') return
  const entry = {
    level,
    time: new Date().toISOString(),
    ...fields,
    ...(message ? { msg: message } : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (fields: LogFields, message?: string) => emit('debug', fields, message),
  info:  (fields: LogFields, message?: string) => emit('info',  fields, message),
  warn:  (fields: LogFields, message?: string) => emit('warn',  fields, message),
  error: (fields: LogFields, message?: string) => emit('error', fields, message),
}

/**
 * Time an async operation and log duration.
 * Returns the result of the operation.
 */
export async function timed<T>(
  route: string,
  fields: LogFields,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    logger.info({ ...fields, route, duration_ms: Date.now() - start, status: 'ok' }, 'request.complete')
    return result
  } catch (err) {
    logger.error(
      {
        ...fields,
        route,
        duration_ms: Date.now() - start,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      },
      'request.error',
    )
    throw err
  }
}
